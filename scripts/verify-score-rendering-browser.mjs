/** Browser collection uses trace presentation IDs; missing or unreviewed frames never pass. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { frameEvidence } from "./score-rendering-frame-evidence.mjs";
import { observeActionState } from "./score-rendering-action-state.mjs";
const { values } = parseArgs({
  options: {
    manifest: { type: "string" },
    runs: { type: "string", default: "5" },
    output: { type: "string" },
    "base-url": { type: "string" },
    "playwright-module": {
      type: "string",
      default: process.env.PLAYWRIGHT_MODULE,
    },
    "storage-state": { type: "string" },
    actions: { type: "string" },
    "browser-path": { type: "string" },
    "score-routes": { type: "string" },
    fixture: { type: "string" },
    "first-condition": { type: "boolean", default: false },
    reload: { type: "boolean", default: false },
    roundtrip: { type: "boolean", default: false },
    "import-workflow": { type: "boolean", default: false },
    lifecycle: { type: "boolean", default: false },
    "font-url": { type: "string" },
    "source-manifest": { type: "string" },
    "instrumentation-record": { type: "string" },
  },
});
for (const name of ["manifest", "output", "base-url", "playwright-module"])
  if (!values[name]) throw new Error(`Missing ${name}`);
const runs = Number(values.runs);
if (!Number.isInteger(runs) || runs < 1) throw new Error("INVALID_RUNS");
const base = new URL(values["base-url"]);
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname))
  throw new Error("Use isolated local server");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJSON = async (file) => JSON.parse(await readFile(file, "utf8"));
const manifest = await readJSON(values.manifest),
  actions = values.actions ? await readJSON(values.actions) : [];
const scoreRoutes = values["score-routes"]
  ? await readJSON(values["score-routes"])
  : null;
const routes = scoreRoutes?.scores ?? null;
const sourceManifest = values["source-manifest"]
  ? await readJSON(values["source-manifest"])
  : null;
const instrumentation = values["instrumentation-record"]
  ? await readJSON(values["instrumentation-record"])
  : null;
if (values["import-workflow"]) {
  if (runs !== 1) throw new Error("IMPORT_WORKFLOW_REQUIRES_RUNS_ONE");
  const { verifyImportWorkflow } =
    await import("./verify-score-import-workflow.mjs");
  await verifyImportWorkflow({ values, manifest });
  // This CLI dispatches to the functional workflow instead of the timing sampler.
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(0);
}
if (values.lifecycle) {
  const { verifyRenderingLifecycle } =
    await import("./verify-score-rendering-lifecycle.mjs");
  await verifyRenderingLifecycle({ values, manifest });
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(0);
}
const conditions = [];
if (routes) {
  for (const fixture of manifest.fixtures.filter(
    (item) => !values.fixture || item.id === values.fixture,
  )) {
    const route = routes.find((item) => item.fixture === fixture.id);
    if (!route) throw new Error("MISSING_FIXTURE_ROUTE");
    for (const layout of values["first-condition"]
      ? manifest.layouts.slice(0, 1)
      : manifest.layouts)
      for (const viewport of values["first-condition"]
        ? manifest.viewports.slice(0, 1)
        : manifest.viewports)
        for (const scale of values["first-condition"]
          ? manifest.scales.slice(0, 1)
          : manifest.scales)
          conditions.push({
            fixture: fixture.id,
            sha256: fixture.sha256,
            layout,
            viewport,
            scale,
            path: route.path,
            canPlay: route.canPlay ?? null,
          });
  }
} else
  conditions.push({
    fixture: values.fixture ?? "scenario",
    layout: manifest.layouts[0],
    viewport: manifest.viewports[0],
    scale: manifest.scales[0],
    path: base.pathname,
  });
if (conditions.length === 0) throw new Error("NO_CONDITIONS");
const { chromium } = await import(
  pathToFileURL(path.resolve(values["playwright-module"])).href
);
const browser = await chromium.launch({
  executablePath: values["browser-path"],
  args: ["--no-sandbox"],
});
const output = {
  measuredAt: new Date().toISOString(),
  collectorSha256: sha(await readFile(new URL(import.meta.url))),
  actionStateObserverSha256: sha(
    await readFile(
      new URL("score-rendering-action-state.mjs", import.meta.url),
    ),
  ),
  actionsSha256: values.actions ? sha(await readFile(values.actions)) : null,
  browser: browser.version(),
  manifestSha256: sha(await readFile(values.manifest)),
  fontSha256: manifest.fontSha256,
  environment: {
    node: process.version,
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    memoryBytes: os.totalmem(),
  },
  sourceHashes: sourceManifest?.sourceSha256 ?? null,
  instrumentation,
  serverMode: "production; precompiled isolated copy",
  measurementKind: values.reload ? "browser-reload" : "browser-cold",
  results: [],
};
const directory = path.dirname(path.resolve(values.output));
await mkdir(directory, { recursive: true });
const limited = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      timer.unref?.();
    }),
  ]);
async function collectTrial(condition, run) {
  const prefix = `${condition.fixture}-${condition.layout}-${condition.viewport.width}x${condition.viewport.height}-${condition.scale}-${run}`;
  const item = {
    ...condition,
    run,
    status: "incomplete",
    inputs: [],
    actions: [],
    evidence: [],
    fontPreloaded: false,
    timingPass: null,
  };
  const context = await browser.newContext({
    storageState: values["storage-state"],
    viewport: condition.viewport,
  });
  let page,
    client,
    deadline,
    traceStarted = false,
    traceStopped = false,
    cutoff = false;
  const trace = [];
  async function stopTrace() {
    if (!traceStarted || traceStopped) return;
    traceStopped = true;
    const complete = new Promise((resolve) =>
      client.once("Tracing.tracingComplete", resolve),
    );
    try {
      await limited(client.send("Tracing.end"), 2000);
      await limited(complete, 2000);
    } catch {
      /* Missing trace is unmeasurable. */
    }
  }
  async function expire() {
    cutoff = true;
    await stopTrace();
    await context.close().catch(() => {});
  }
  function armDeadline() {
    clearTimeout(deadline);
    deadline = setTimeout(() => expire().catch(() => {}), manifest.cutoffMs);
  }
  try {
    // Warm network assets outside the measured new page. The score/job remains cold.
    const preload = await context.newPage();
    await preload.goto(base.origin, {
      waitUntil: "domcontentloaded",
      timeout: manifest.cutoffMs,
    });
    if (values["font-url"]) {
      await preload.evaluate(async (fontURL) => {
        const font = await new FontFace(
          "MeasurementBravura",
          `url(${fontURL})`,
        ).load();
        document.fonts.add(font);
        await fetch("/A320U.sf2").then((response) => response.arrayBuffer());
      }, new URL(values["font-url"], base).href);
      item.fontPreloaded = true;
    }
    await preload.close();
    page = await context.newPage();
    if (values.reload) {
      await page.addInitScript(({ layout, scale }) => {
        localStorage.setItem(
          "layoutType",
          JSON.stringify(["Horizontal", "Vertical", "Page"].indexOf(layout)),
        );
        localStorage.setItem("scale", JSON.stringify(scale));
        localStorage.setItem("debug", "false");
      }, condition);
      await page.goto(new URL(condition.path, base).href, {
        waitUntil: "domcontentloaded",
      });
      await page
        .locator('[data-layout][data-render-state="ready"] svg')
        .waitFor({ timeout: manifest.cutoffMs });
      await page.evaluate(() => document.fonts.ready);
    }
    client = await context.newCDPSession(page);
    client.on("Tracing.dataCollected", ({ value }) => trace.push(...value));
    await client.send("Tracing.start", {
      categories:
        "devtools.timeline,blink.user_timing,latencyInfo,disabled-by-default-devtools.screenshot",
      transferMode: "ReportEvents",
    });
    traceStarted = true;
    await page.exposeBinding("__reportRenderingInput", (_source, input) =>
      item.inputs.push(input),
    );
    await page.exposeBinding("__reportRenderingFocus", (_source, focus) => {
      if (item.actions.some((action) => action.inputId === focus.inputId))
        return;
      const index = item.actions.some(
        (action) => action.index === "during-render",
      )
        ? `during-render-${item.actions.filter((action) => action.type === "keydown").length}`
        : "during-render";
      item.actions.push({
        index,
        type: "keydown",
        inputId: focus.inputId,
        expectedStateObserved: true,
      });
      item.evidence.push({
        tag: `action-${index}`,
        stateName: focus.stateName,
        stopName: null,
        anchor: focus.anchor,
        expectedFocus: focus.target,
        viewport: focus.viewport,
        screenshot: null,
      });
    });
    await page.exposeBinding(
      "__reportRenderingCandidate",
      (_source, candidate) => {
        item.candidate = candidate;
        armDeadline();
        if (routes && !item.inputProbe) {
          item.inputProbe = {
            phase: "during-render",
            key: "Tab",
            measurable: false,
          };
          setTimeout(() => {
            client
              .send("Input.dispatchKeyEvent", {
                type: "keyDown",
                key: "Tab",
                code: "Tab",
                windowsVirtualKeyCode: 9,
                nativeVirtualKeyCode: 9,
              })
              .catch(() => {});
            client
              .send("Input.dispatchKeyEvent", {
                type: "keyUp",
                key: "Tab",
                code: "Tab",
                windowsVirtualKeyCode: 9,
                nativeVirtualKeyCode: 9,
              })
              .catch(() => {});
          }, 50);
        }
      },
    );
    await page.addInitScript(
      ({ condition }) => {
        try {
          localStorage.setItem("scale", JSON.stringify(condition.scale));
          localStorage.setItem(
            "layoutType",
            JSON.stringify(
              ["Horizontal", "Vertical", "Page"].indexOf(condition.layout),
            ),
          );
          localStorage.setItem("debug", "false");
        } catch {
          /* Initial about:blank has no storage. */
        }
        const inputs = [];
        Object.defineProperty(globalThis, "__renderingProbe", {
          value: { inputs, generation: 0 },
        });
        const originalMark = performance.mark.bind(performance);
        performance.mark = (name, options) => {
          const mark = originalMark(name, options);
          if (name === "rendering:candidate-available") {
            globalThis.__renderingProbe.generation++;
            globalThis.__reportRenderingCandidate({
              timeOrigin: performance.timeOrigin,
              startTime: mark.startTime,
              generation: globalThis.__renderingProbe.generation,
            });
          }
          return mark;
        };
        for (const type of ["click", "keydown", "input", "resize"])
          addEventListener(
            type,
            (event) => {
              const input = {
                id: `input-${performance.timeOrigin}-${inputs.length}`,
                pageId: String(performance.timeOrigin),
                generation:
                  document.querySelector("[data-render-generation]")?.dataset
                    .renderGeneration ?? globalThis.__renderingProbe.generation,
                type,
                trusted: event.isTrusted,
                timeOrigin: performance.timeOrigin,
                inputReceived: event.timeStamp,
                handlerStart: performance.now(),
              };
              inputs.push(input);
              performance.mark(`rendering:${input.id}:handler`);
              globalThis.__reportRenderingInput(input);
            },
            { capture: true },
          );
        const focusedInputs = new Set();
        addEventListener(
          "focusin",
          (event) => {
            const input = inputs.at(-1);
            if (
              input?.type !== "keydown" ||
              event.target === document.body ||
              focusedInputs.has(input.id)
            )
              return;
            focusedInputs.add(input.id);
            const element = event.target;
            const box = element.getBoundingClientRect();
            const stateName = `rendering:focus-state:${input.id}`;
            performance.mark(stateName);
            globalThis.__reportRenderingFocus({
              inputId: input.id,
              stateName,
              target: {
                tag: element.tagName,
                outlineWidth: getComputedStyle(element).outlineWidth,
              },
              viewport: { width: innerWidth, height: innerHeight },
              anchor: {
                x: Math.max(0, box.x - 8),
                y: Math.max(0, box.y - 8),
                width:
                  Math.min(innerWidth, box.x + box.width + 8) -
                  Math.max(0, box.x - 8),
                height:
                  Math.min(innerHeight, box.y + box.height + 8) -
                  Math.max(0, box.y - 8),
              },
            });
          },
          { capture: true },
        );
        let previous;
        new MutationObserver((records) => {
          for (const record of records) {
            if (
              !(record.target instanceof Element) ||
              !record.target.matches("[data-layout]")
            )
              continue;
            for (const node of record.addedNodes) {
              if (node instanceof SVGSVGElement && node !== previous) {
                previous = node;
                performance.mark("rendering:svg-bound");
              }
            }
          }
        }).observe(document, { childList: true, subtree: true });
      },
      { condition },
    );
    async function capture(stateName, tag, selector, nativeSelector) {
      const box = nativeSelector
        ? await page.evaluate((query) => {
            const element = document.querySelector(query);
            if (!element) return null;
            const { x, y, width, height } = element.getBoundingClientRect();
            return { x, y, width, height };
          }, nativeSelector)
        : selector
          ? await page.locator(selector).first().boundingBox()
          : null;
      const anchor = box
        ? {
            x: Math.max(0, box.x - 4),
            y: Math.max(0, box.y - 4),
            width:
              Math.min(page.viewportSize().width, box.x + box.width + 64) -
              Math.max(0, box.x - 4),
            height:
              Math.min(page.viewportSize().height, box.y + box.height + 4) -
              Math.max(0, box.y - 4),
          }
        : null;
      // Synchronization only: timing requires the matching trace presentation and image review.
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      // CDP captures the same visible page without Playwright walking every SVG
      // descendant to prepare animations/carets during the measured interval.
      const screenshot = await client.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
      });
      await writeFile(
        path.join(directory, `${prefix}-${tag}.png`),
        Buffer.from(screenshot.data, "base64"),
      );
      const stopName = `rendering:capture:${tag}`;
      await page.evaluate((name) => performance.mark(name), stopName);
      item.evidence.push({
        tag,
        stateName,
        stopName,
        anchor,
        screenshot: `${prefix}-${tag}.png`,
        viewport: page.viewportSize(),
      });
    }
    armDeadline();
    await (values.reload
      ? page.reload({ waitUntil: "domcontentloaded", timeout: 0 })
      : page.goto(new URL(condition.path, base).href, {
          waitUntil: "domcontentloaded",
          timeout: 0,
        }));
    if (routes) {
      await page
        .locator("[data-layout] svg")
        .waitFor({ state: "visible", timeout: 0 });
      await page.evaluate(() => document.fonts.ready);
      item.display = await page
        .locator("[data-layout]")
        .evaluate((element) => ({
          width: element.clientWidth,
          height: element.clientHeight,
          pageHeight: element.style.height,
          layout: element.dataset.layout,
        }));
      await capture("rendering:svg-bound", "cold", "[data-layout] svg");
    }
    const trialActions = [];
    if (values.roundtrip) {
      if (typeof condition.canPlay !== "boolean")
        throw new Error("ROUNDTRIP_PLAYBACK_CONDITION_REQUIRED");
      // The cold endpoint was captured above. Settle the normal idle playback
      // highlight before taking the functional round-trip reference, so a
      // later soundfont decode is not mistaken for a geometry difference.
      if (condition.canPlay) {
        await page
          .locator('button[aria-label="再生"]')
          .waitFor({ timeout: 10_000 });
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
      }
      const directLayout = await page.evaluate(() =>
        Boolean(
          document.querySelector(
            '[role="radiogroup"][aria-label="layouttype-input"]',
          ),
        ),
      );
      const ready = {
        selector: "[data-layout]",
        attributes: { "data-render-state": "ready" },
        previousGeneration: "current",
      };
      const changes =
        condition.layout === "Horizontal"
          ? [
              {
                type: "fill",
                selector: 'input[aria-label="scale-input"]',
                value: String(
                  manifest.scales.find((scale) => scale !== condition.scale),
                ),
              },
              {
                type: "fill",
                selector: 'input[aria-label="scale-input"]',
                value: String(condition.scale),
              },
            ]
          : condition.layout === "Vertical"
            ? [
                {
                  type: "resize",
                  viewport: manifest.viewports.find(
                    (viewport) => viewport.width !== condition.viewport.width,
                  ),
                },
                { type: "resize", viewport: condition.viewport },
              ]
            : [
                { type: "layout", layout: "Horizontal" },
                { type: "layout", layout: "Page" },
              ];
      item.roundtrip = {
        initialScroll: await page.evaluate(() => ({ x: scrollX, y: scrollY })),
        initialGeometry: await page
          .locator("[data-layout] svg")
          .evaluate((svg) => ({
            width: svg.getAttribute("width"),
            height: svg.getAttribute("height"),
            viewBox: svg.getAttribute("viewBox"),
          })),
        control: directLayout ? "direct-radio" : "popover-select",
        dimension:
          condition.layout === "Horizontal"
            ? "scale"
            : condition.layout === "Vertical"
              ? "viewport"
              : "layout",
        before: {
          layout: condition.layout,
          viewport: condition.viewport,
          scale: condition.scale,
        },
        changes,
        initialSVGSha256: sha(
          await page
            .locator("[data-layout] svg")
            .evaluate((element) => element.outerHTML),
        ),
      };
      trialActions.push(
        ...changes.flatMap((action) => [
          ...(action.type === "layout" && !directLayout
            ? [
                {
                  type: "open-layout",
                  expect: '[role="listbox"]',
                  observeState: { selector: '[role="listbox"]' },
                  budgetMs: 100,
                },
              ]
            : []),
          {
            ...action,
            observeState: ready,
            expect: '[data-render-state="ready"] svg',
            budgetMs: 6500,
          },
        ]),
      );
      if (condition.layout === "Page") {
        const next = page.getByRole("button", {
          name: "次のページ",
          exact: true,
        });
        if (await next.isEnabled()) {
          trialActions.push(
            {
              type: "page",
              direction: "next",
              expect: '[data-layout] svg[data-page-index="1"]',
              observeState: {
                selector: "[data-layout] svg",
                attributes: { "data-page-index": "1" },
              },
              budgetMs: 100,
            },
            {
              type: "page",
              direction: "previous",
              expect: '[data-layout] svg[data-page-index="0"]',
              observeState: {
                selector: "[data-layout] svg",
                attributes: { "data-page-index": "0" },
              },
              budgetMs: 100,
            },
          );
        } else item.roundtrip.singlePage = true;
      }
    }
    if (values.roundtrip) trialActions.push({ type: "roundtrip-checkpoint" });
    trialActions.push(...actions);
    for (const [index, action] of trialActions.entries()) {
      if (action.type === "roundtrip-checkpoint") {
        item.roundtrip.finalSVGSha256 = sha(
          await page
            .locator("[data-layout] svg")
            .evaluate((element) => element.outerHTML),
        );
        item.roundtrip.finalGeometry = await page
          .locator("[data-layout] svg")
          .evaluate((svg) => ({
            width: svg.getAttribute("width"),
            height: svg.getAttribute("height"),
            viewBox: svg.getAttribute("viewBox"),
          }));
        item.roundtrip.svgUnchanged =
          item.roundtrip.initialSVGSha256 === item.roundtrip.finalSVGSha256;
        continue;
      }
      if (action.waitFor)
        await page
          .locator(action.waitFor)
          .waitFor({ state: "attached", timeout: 0 });
      const retirementPresentBefore = action.whilePresent
        ? await page.evaluate(
            (selector) => Boolean(document.querySelector(selector)),
            action.whilePresent,
          )
        : undefined;
      if (retirementPresentBefore === false)
        throw new Error("RETIREMENT_NOT_IN_PROGRESS");
      const generationBefore = await page.evaluate(
        () =>
          document.querySelector("[data-render-generation]")?.dataset
            .renderGeneration,
      );
      // Return to the same window offset before opening the condition menu.
      // Both opening and selecting are measured trusted clicks.
      if (action.type === "open-layout") {
        await page.evaluate(
          ({ x, y }) => scrollTo(x, y),
          item.roundtrip.initialScroll,
        );
      }
      if (action.observeState)
        await page.evaluate(observeActionState, {
          index,
          ...action.observeState,
          inputType:
            action.type === "resize"
              ? "resize"
              : action.type === "fill"
                ? "input"
                : "click",
          previousGeneration:
            action.observeState.previousGeneration === "current"
              ? generationBefore
              : action.observeState.previousGeneration,
        });
      switch (action.type) {
        case "open-layout": {
          await page
            .locator('button[aria-label="layouttype-input"]')
            .click({ timeout: 0 });
          break;
        }
        case "resize": {
          await page.setViewportSize(action.viewport);
          break;
        }
        case "layout": {
          const key = ["Horizontal", "Vertical", "Page"].indexOf(action.layout);
          await (item.roundtrip.control === "direct-radio"
            ? page
                .locator(
                  `[role="radiogroup"][aria-label="layouttype-input"] label:has(input[type="radio"][value="${key}"])`,
                )
                .click({ timeout: 0 })
            : page
                .locator(`[role="option"][data-key="${key}"]`)
                .click({ timeout: 0 }));
          break;
        }
        case "page": {
          await page
            .getByRole("button", {
              name: action.direction === "next" ? "次のページ" : "前のページ",
              exact: true,
            })
            .click({ timeout: 0 });
          break;
        }
        case "upload": {
          await page.locator(action.selector).setInputFiles(action.path);
          break;
        }
        case "click": {
          await page.locator(action.selector).click({ timeout: 0 });
          break;
        }
        case "fill": {
          await page
            .locator(action.selector)
            .fill(action.value, { timeout: 0 });
          break;
        }
        case "goto": {
          await page.goto(new URL(action.path, base).href, {
            waitUntil: "domcontentloaded",
            timeout: 0,
          });
          break;
        }
        default: {
          throw new Error("UNSUPPORTED_ACTION");
        }
      }
      if (values.roundtrip && action.budgetMs === 6500) {
        await client.send("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: "Tab",
          code: "Tab",
          windowsVirtualKeyCode: 9,
          nativeVirtualKeyCode: 9,
        });
        await client.send("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: "Tab",
          code: "Tab",
          windowsVirtualKeyCode: 9,
          nativeVirtualKeyCode: 9,
        });
      }
      if (action.observeState)
        await page.evaluate(async (actionIndex) => {
          await globalThis.__renderingProbe.actionStates[actionIndex].done;
        }, index);
      else if (action.expect)
        await page
          .locator(action.expect)
          .waitFor({ state: "visible", timeout: 0 });
      if (!action.observeState && action.expectValue !== undefined)
        await page.waitForFunction(
          ({ selector, value }) =>
            document.querySelector(selector)?.value === value,
          { selector: action.selector, value: action.expectValue },
          { timeout: 0 },
        );
      const stateName = `rendering:action-state:${index}`;
      const inputId = await page.evaluate(
        ({ name, observed }) => {
          if (performance.getEntriesByName(name).length === 0) {
            if (observed) throw new Error("STATE_COMMIT_NOT_OBSERVED");
            performance.mark(name);
          }
          return observed
            ? globalThis.__renderingProbe.actionStates[
                Number(name.split(":").at(-1))
              ].inputId
            : globalThis.__renderingProbe.inputs.at(-1)?.id;
        },
        { name: stateName, observed: Boolean(action.observeState) },
      );
      const actionRecord = {
        index,
        type: action.type,
        budgetMs: action.budgetMs ?? 100,
        generationBefore,
        generationAfter: await page.evaluate(
          () =>
            document.querySelector("[data-render-generation]")?.dataset
              .renderGeneration,
        ),
        inputId,
        retirementPresentBefore,
        stateObservation: action.observeState
          ? "in-page DOM commit"
          : "automation confirmation",
        expectedStateObserved: Boolean(
          action.expect || action.expectValue !== undefined,
        ),
      };
      item.actions.push(actionRecord);
      await capture(
        stateName,
        `action-${index}`,
        action.expect ?? action.selector,
        action.observeState?.selector,
      );
      if (action.afterCapturePresent) {
        await page
          .locator(action.afterCapturePresent)
          .waitFor({ state: "attached", timeout: 0 });
        actionRecord.followupPresent = true;
        const name = `rendering:followup:${index}`;
        await page.evaluate((name) => performance.mark(name), name);
        await capture(name, `followup-${index}`, action.afterCapturePresent);
      }
      if (action.afterCaptureAbsent) {
        await page.waitForFunction(
          (selector) => !document.querySelector(selector),
          action.afterCaptureAbsent,
          { timeout: 10_000, polling: 50 },
        );
        actionRecord.retirementCompleted = true;
      }
    }
    if (!routes && actions.length === 0)
      await capture("rendering:svg-bound", "scenario");
    item.status = "frame-review-required";
  } catch {
    item.status = cutoff ? "cutoff" : "setup-or-action-failure";
  } finally {
    clearTimeout(deadline);
    // Presentation feedback for the last captured frame can arrive after its
    // capture marker. Keep tracing briefly without extending any evidence
    // window or changing the input/presentation timestamps used for timing.
    if (!cutoff && traceStarted && !traceStopped)
      await new Promise((resolve) => setTimeout(resolve, 200));
    await stopTrace();
    const firstCandidate = trace.find(
      (event) => event.name === "rendering:candidate-available",
    );
    if (cutoff && !firstCandidate) {
      item.status = "setup-or-action-failure";
      item.failureReason = "candidate-not-observed";
    }
    item.evidence = item.evidence.map((evidence) => ({
      ...evidence,
      ...frameEvidence(trace, evidence.stateName, evidence.stopName),
    }));
    for (const evidence of item.evidence) {
      for (const [index, candidate] of (evidence.candidates ?? []).entries()) {
        const image = trace.find(
          (event) =>
            event.name === "Screenshot" &&
            event.ts === candidate.frameScreenshotTimestamp,
        );
        if (image) {
          candidate.frameImage = `${prefix}-${evidence.tag}-frame-${index}.jpg`;
          await writeFile(
            path.join(directory, candidate.frameImage),
            Buffer.from(image.args.snapshot, "base64"),
          );
        }
      }
      evidence.frameImage = evidence.candidates?.[0]?.frameImage;
    }
    const cold = item.evidence.find((evidence) => evidence.tag === "cold");
    item.candidateColdMs =
      firstCandidate && cold?.candidateFramePresented
        ? cold.candidateFramePresented - firstCandidate.ts / 1000
        : null;
    item.candidateReceivedTraceMs = firstCandidate
      ? firstCandidate.ts / 1000
      : null;
    if (item.inputProbe) {
      const accepted = trace.find(
        (event) =>
          /^InputLatency::(?:RawKeyDown|KeyDown)$/.test(event.name) &&
          event.ts / 1000 >= (item.candidateReceivedTraceMs ?? Infinity),
      );
      item.inputProbe.browserAcceptedTraceMs = accepted
        ? accepted.ts / 1000
        : null;
      item.inputProbe.handlerObserved = item.inputs.some(
        (input) => input.type === "keydown",
      );
    }
    item.elapsedMeasurementKind = `${values.reload ? "reload-new-job" : "cold-new-page"}; network/font/audio fetch prewarmed outside candidate interval`;
    item.coldWarm = values.reload ? "reload" : "cold";
    item.stages = [
      {
        name: "render-to-DOM",
        startedTraceMs: item.candidateReceivedTraceMs,
        endedTraceMs: cold?.stateCommitted ?? null,
      },
    ];
    item.cutoffStage = cutoff
      ? item.candidateReceivedTraceMs === null
        ? "setup"
        : cold
          ? "actions"
          : "render-to-DOM"
      : null;
    item.coldMs = null;
    item.cutoffMs = cutoff ? manifest.cutoffMs : null;
    item.inputs = item.inputs.map((input) => {
      const handler = trace.find(
          (event) => event.name === `rendering:${input.id}:handler`,
        ),
        offset = handler
          ? handler.ts / 1000 - handler.args.data.startTime
          : null;
      const action = item.actions.find((entry) => entry.inputId === input.id),
        evidence = item.evidence.find(
          (entry) => entry.tag === `action-${action?.index}`,
        );
      const received = offset === null ? null : input.inputReceived + offset;
      return {
        ...input,
        clock:
          offset === null
            ? null
            : {
                traceUnits: "microseconds",
                performanceUnits: "milliseconds",
                performanceToTraceOffsetMs: offset,
                timeOrigin: input.timeOrigin,
              },
        inputReceivedTraceMs: received,
        handlerStartTraceMs: handler ? handler.ts / 1000 : null,
        inputDelay: input.handlerStart - input.inputReceived,
        stateCommitted: evidence?.stateCommitted ?? null,
        framePresented: null,
        candidateFramePresented: evidence?.candidateFramePresented ?? null,
        candidateResponseMs:
          received !== null && evidence?.candidateFramePresented
            ? evidence.candidateFramePresented - received
            : null,
        responseMs: null,
        measurable: false,
      };
    });
    const text = JSON.stringify({ traceEvents: trace });
    item.trace = `${prefix}-trace.json`;
    item.traceSha256 = sha(text);
    await writeFile(path.join(directory, item.trace), text);
    item.note =
      "Only reviewed screenshot content with matching source_id/frame_sequence presentation can establish completion. DOM or rAF alone never passes. Missing input/clock/frame evidence remains unmeasurable.";
    output.results.push(item);
    output.summary = {
      trials: output.results.length,
      cutoffs: output.results.filter((result) => result.status === "cutoff")
        .length,
      failures: output.results.filter(
        (result) => result.status === "setup-or-action-failure",
      ).length,
      unreviewed: output.results.filter((result) => result.timingPass === null)
        .length,
      maxMs: null,
      medianMs: null,
    };
    await writeFile(values.output, JSON.stringify(output, null, 2) + "\n");
    await context.close().catch(() => {});
    process.stderr.write(`${prefix}: ${item.status}\n`);
  }
}
try {
  for (const condition of conditions)
    for (let run = 1; run <= runs; run++) await collectTrial(condition, run);
} finally {
  await browser.close();
}
