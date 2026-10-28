/** Controlled production-copy lifecycle verification; no control hook belongs to the product. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { frameEvidence } from "./score-rendering-frame-evidence.mjs";
import { observeActionState } from "./score-rendering-action-state.mjs";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function verifyRenderingLifecycle({ values, manifest }) {
  const out = path.dirname(path.resolve(values.output));
  await mkdir(out, { recursive: true });
  const fixtures = values.fixture
    ? [
        values.fixture === "naitoobunaitsu-bitomario"
          ? "original"
          : values.fixture === "quarter_middle_c"
            ? "quarter"
            : values.fixture,
      ]
    : ["quarter", "original"];
  if (fixtures.some((fixture) => !["quarter", "original"].includes(fixture)))
    throw new Error("UNKNOWN_LIFECYCLE_FIXTURE");
  const { chromium } = await import(
    pathToFileURL(values["playwright-module"]).href
  );
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const report = {
    measurementKind: "controlled-production-lifecycle",
    fixedInputLimitMs: 100,
    collectorSha256: sha(await readFile(new URL(import.meta.url))),
    frameEvidenceSha256: sha(
      await readFile(
        new URL("score-rendering-frame-evidence.mjs", import.meta.url),
      ),
    ),
    results: [],
    timingPass: null,
  };
  const persist = () =>
    writeFile(values.output, JSON.stringify(report, null, 2) + "\n");
  try {
    for (const fixture of fixtures)
      for (let run = 1; run <= Number(values.runs); run++) {
        const context = await browser.newContext({
          storageState: values["storage-state"],
          viewport: { width: 1280, height: 900 },
        });
        const page = await context.newPage();
        const item = {
          fixture,
          layout: "Horizontal",
          viewport: { width: 1280, height: 900 },
          scale: 12,
          run,
          inputs: [],
          actions: [],
          evidence: [],
          pageErrors: [],
          unexpectedWrites: [],
          status: "running",
        };
        report.results.push(item);
        const prefix = `${fixture}-Horizontal-1280x900-12-${run}`;
        page.on("pageerror", (error) => item.pageErrors.push(error.message));
        page.on("request", (request) => {
          if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()))
            item.unexpectedWrites.push({
              method: request.method(),
              path: new URL(request.url()).pathname,
            });
        });
        try {
          await page.addInitScript(() => {
            localStorage.setItem("debug", "false");
            localStorage.setItem("scale", "12");
            localStorage.setItem("layoutType", "0");
            const NativeResizeObserver = globalThis.ResizeObserver;
            const observedTargets = [];
            globalThis.ResizeObserver = class extends NativeResizeObserver {
              constructor(callback) {
                super(callback);
                this.targets = new Set();
                observedTargets.push(this.targets);
              }
              observe(target, options) {
                this.targets.add(target);
                super.observe(target, options);
              }
              unobserve(target) {
                this.targets.delete(target);
                super.unobserve(target);
              }
              disconnect() {
                this.targets.clear();
                super.disconnect();
              }
            };
            globalThis.__scoreObserverTargets = observedTargets;
            const inputs = [];
            globalThis.__renderingProbe = { inputs, actionStates: {} };
            addEventListener(
              "click",
              (event) => {
                const input = {
                  id: `input-${performance.timeOrigin}-${inputs.length}`,
                  type: "click",
                  trusted: event.isTrusted,
                  timeOrigin: performance.timeOrigin,
                  inputReceived: event.timeStamp,
                  handlerStart: performance.now(),
                };
                inputs.push(input);
                performance.mark(`rendering:${input.id}:handler`);
              },
              { capture: true },
            );
          });
          await page.goto(new URL("/", values["base-url"]).href, {
            waitUntil: "domcontentloaded",
          });
          await page.evaluate(async () => {
            await fetch("/A320U.sf2").then((response) =>
              response.arrayBuffer(),
            );
          });
          await page.goto(
            new URL(
              `/dev/render-lifecycle?fixture=${fixture}`,
              values["base-url"],
            ).href,
            { waitUntil: "domcontentloaded" },
          );
          const ready = () =>
            page
              .locator('[data-render-state="ready"]:not([aria-hidden]) > svg')
              .waitFor({ timeout: manifest.cutoffMs });
          await ready();
          await page.evaluate(() => document.fonts.ready);
          const client = await context.newCDPSession(page),
            trace = [];
          client.on("Tracing.dataCollected", ({ value }) =>
            trace.push(...value),
          );
          await client.send("Tracing.start", {
            categories:
              "devtools.timeline,blink.user_timing,latencyInfo,disabled-by-default-devtools.screenshot",
            transferMode: "ReportEvents",
          });
          const profileEnabled = process.env.RENDER_LIFECYCLE_PROFILE === "1";
          if (profileEnabled) {
            await client.send("Profiler.enable");
            await client.send("Profiler.start");
          }
          let index = 0;
          const action = async (label, selector, attributes, text) => {
            const own = index++;
            await page.evaluate(observeActionState, {
              index: own,
              selector,
              attributes,
              text,
              inputType: "click",
            });
            await page
              .getByRole(label === "Leave verification" ? "link" : "button", {
                name: label,
                exact: true,
              })
              .click();
            let timer;
            try {
              await Promise.race([
                page.evaluate(
                  (index_) =>
                    globalThis.__renderingProbe.actionStates[index_].done,
                  own,
                ),
                new Promise((_, reject) => {
                  timer = setTimeout(
                    () => reject(new Error("ACTION_STATE_CUTOFF")),
                    manifest.cutoffMs,
                  );
                }),
              ]);
            } finally {
              clearTimeout(timer);
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
            const capture = await client.send("Page.captureScreenshot", {
              format: "png",
              fromSurface: true,
            });
            await writeFile(
              path.join(out, `${prefix}-action-${own}.png`),
              Buffer.from(capture.data, "base64"),
            );
            const data = await page.evaluate((index_) => {
              performance.mark(`rendering:lifecycle-capture:${index_}`);
              const state = globalThis.__renderingProbe.actionStates[index_];
              const input = globalThis.__renderingProbe.inputs.find(
                (input) => input.id === state.inputId,
              );
              return { input, inputId: state.inputId };
            }, own);
            item.inputs.push(data.input);
            item.actions.push({ index: own, label, inputId: data.inputId });
          };
          const state = "[data-layout]";
          await action("Start held", state, { "data-render-state": "loading" });
          if (profileEnabled) {
            const { profile } = await client.send("Profiler.stop");
            await writeFile(
              path.join(out, `${prefix}.cpuprofile`),
              JSON.stringify(profile),
            );
            await client.send("Profiler.disable");
          }
          await page.waitForFunction(() => globalThis.__renderLifecycle.held);
          await action("表示を取消", state, {
            "data-render-state": "cancelled",
          });
          await page
            .getByRole("button", { name: "Release A", exact: true })
            .click();
          await page.evaluate(() => {
            globalThis.__renderLifecycle.nextMode = "wait";
          });
          await action("再試行", state, { "data-render-state": "loading" });
          await page.evaluate(() => globalThis.__renderLifecycle.release());
          await ready();
          await action("Fail render", state, { "data-render-state": "error" });
          await page.evaluate(() => {
            globalThis.__renderLifecycle.nextMode = "wait";
          });
          await action("再試行", state, { "data-render-state": "loading" });
          await page.evaluate(() => globalThis.__renderLifecycle.release());
          await ready();
          item.staleChecks = [];
          for (const mode of ["Late success", "Late failure"]) {
            await action(mode, state, { "data-render-state": "loading" });
            await page.waitForFunction(() => globalThis.__renderLifecycle.held);
            const previousGeneration = await page
              .locator(state)
              .getAttribute("data-render-generation");
            await action(
              "Switch source",
              `[data-layout][data-render-state="loading"]:not(:has(svg)), [data-layout][data-render-state="ready"]:not([data-render-generation="${previousGeneration}"])`,
            );
            await ready();
            const before = await page.locator(state).evaluate((element) => ({
              svg: element.querySelector("svg").outerHTML,
              generation: element.dataset.renderGeneration,
              sourceIds: new Set(
                [...element.querySelectorAll('g[type="note"]')].map(
                  (note) => `${note.dataset.trackId}/${note.dataset.noteId}`,
                ),
              ).size,
            }));
            const counts = await page.evaluate(() => ({
              disposed: globalThis.__renderLifecycle.disposed,
              published: globalThis.__renderLifecycle.published,
            }));
            await page
              .getByRole("button", { name: "Release A", exact: true })
              .click();
            await page.waitForFunction(
              () =>
                document.querySelector("[data-probe-feedback]").textContent ===
                "A released",
            );
            await new Promise((resolve) => setTimeout(resolve, 100));
            const after = await page.locator(state).evaluate((element) => ({
              svg: element.querySelector("svg").outerHTML,
              generation: element.dataset.renderGeneration,
              sourceIds: new Set(
                [...element.querySelectorAll('g[type="note"]')].map(
                  (note) => `${note.dataset.trackId}/${note.dataset.noteId}`,
                ),
              ).size,
            }));
            const latest = await page.evaluate(() => ({
              disposed: globalThis.__renderLifecycle.disposed,
              published: globalThis.__renderLifecycle.published,
            }));
            const expectedSourceIds = (
              mode === "Late success"
                ? fixture !== "original"
                : fixture === "original"
            )
              ? 5540
              : 2;
            const pass =
              before.sourceIds === expectedSourceIds &&
              before.svg === after.svg &&
              before.generation === after.generation &&
              counts.published === latest.published &&
              (mode !== "Late success" || latest.disposed > counts.disposed);
            item.staleChecks.push({
              mode,
              pass,
              sourceIds: after.sourceIds,
              svgSha256: sha(after.svg),
              generation: after.generation,
            });
            if (!pass) throw new Error("STALE_PUBLICATION_OR_RESOURCE_LEAK");
          }
          await action("Start held", state, { "data-render-state": "loading" });
          await page.waitForFunction(() => globalThis.__renderLifecycle.held);
          // Trace the real Next Link navigation, retaining the ordinary application header.
          await action("Leave verification", "h1", undefined, "楽譜");
          await page.waitForFunction(
            () => !document.querySelector("[data-layout]"),
          );
          item.activeScoreObserversAfterExit = await page.evaluate(
            () =>
              globalThis.__scoreObserverTargets
                .flatMap((targets) => [...targets])
                .filter((target) =>
                  target.matches("[data-layout], [aria-owns]"),
                ).length,
          );
          if (item.activeScoreObserversAfterExit !== 0)
            throw new Error("SCORE_OBSERVER_LEAK");
          const done = new Promise((resolve) =>
            client.once("Tracing.tracingComplete", resolve),
          );
          await client.send("Tracing.end");
          await done;
          item.trace = `${prefix}-trace.json`;
          const traceBytes = JSON.stringify({ traceEvents: trace });
          item.traceSha256 = sha(traceBytes);
          await writeFile(path.join(out, item.trace), traceBytes);
          for (const entry of item.actions) {
            const evidence = {
              tag: `action-${entry.index}`,
              ...frameEvidence(
                trace,
                `rendering:action-state:${entry.index}`,
                `rendering:lifecycle-capture:${entry.index}`,
              ),
            };
            for (const [candidateIndex, candidate] of (
              evidence.candidates ?? []
            ).entries()) {
              const screenshot = trace.find(
                (event) =>
                  event.name === "Screenshot" &&
                  event.ts === candidate.frameScreenshotTimestamp,
              );
              candidate.frameImage = `${prefix}-${evidence.tag}-frame-${candidateIndex}.jpg`;
              await writeFile(
                path.join(out, candidate.frameImage),
                Buffer.from(screenshot.args.snapshot, "base64"),
              );
            }
            item.evidence.push(evidence);
          }
          // Use the same trace/performance clock correspondence as the ordinary collector.
          item.inputs = item.inputs.map((input) => {
            const handler = trace.find(
              (event) => event.name === `rendering:${input.id}:handler`,
            );
            const offset = handler
              ? handler.ts / 1000 - handler.args.data.startTime
              : null;
            return {
              ...input,
              inputReceivedTraceMs:
                offset === null ? null : input.inputReceived + offset,
              handlerStartTraceMs: handler ? handler.ts / 1000 : null,
              inputDelay: input.handlerStart - input.inputReceived,
              clock:
                offset === null
                  ? null
                  : {
                      traceUnits: "microseconds",
                      performanceUnits: "milliseconds",
                      performanceToTraceOffsetMs: offset,
                      timeOrigin: input.timeOrigin,
                    },
            };
          });
          item.status = "complete";
          if (item.pageErrors.length > 0 || item.unexpectedWrites.length > 0)
            throw new Error("ERROR_OR_UNEXPECTED_WRITE");
        } catch (error) {
          item.status = "failed";
          item.error = error.message;
          throw error;
        } finally {
          await persist();
          await context.close();
        }
        console.log(
          `${fixture} run ${run}: lifecycle functional checks complete; frame review required`,
        );
      }
  } finally {
    await browser.close();
    await persist();
  }
}
