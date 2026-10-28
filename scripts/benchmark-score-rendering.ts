import { fork } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import os from "node:os";
import { referenceMemoization } from "./score-rendering-reference";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";
const { JSDOM } = createRequire(import.meta.url)("jsdom");

type Input = {
  sourceRoot: string;
  fixture: { id: string; path: string; sha256: string };
  layout: string;
  viewport: { width: number; height: number };
  scale: number;
  referenceDirectory?: string;
  memoizedReference?: boolean;
};
const sha = (text: string | Uint8Array) =>
  createHash("sha256").update(text).digest("hex");
async function child(input: Input) {
  const from = (name: string) =>
    import(pathToFileURL(path.join(input.sourceRoot, name)).href);
  const { convertScore } = await from("src/s-core/models/import/convert.ts");
  const Engraving = await from("src/s-core/models/engraving/index.ts");
  const Sheet = await from("src/s-core/models/sheet/index.ts");
  await from("src/s-core/models/document/extensions/to-svg.ts");
  const bytes = await readFile(path.join(input.sourceRoot, input.fixture.path));
  if (sha(bytes) !== input.fixture.sha256)
    throw new Error("FIXTURE_HASH_MISMATCH");
  const converted = await convertScore({
    bytes,
    sourceName: input.fixture.path,
    options: { mode: "PRESERVE" },
  });
  if ("format" in converted.candidate) throw new Error("PARTIAL_FIXTURE");
  const stages: {
    name: string;
    startedMs: number;
    endedMs: number;
    ms: number;
  }[] = [];
  const measure = <T>(name: string, run: () => T): T => {
    process.send?.({
      stage: name,
      status: "started",
      startedNs: process.hrtime.bigint().toString(),
    });
    const t = performance.now();
    const result = run();
    const endedMs = performance.now();
    stages.push({ name, startedMs: t, endedMs, ms: endedMs - t });
    process.send?.({
      stage: name,
      status: "complete",
      measurement: stages.at(-1),
    });
    return result;
  };
  const modelStartedNs = process.hrtime.bigint().toString();
  process.send?.({ modelStartedNs });
  const start = performance.now();
  const score = measure("import", () =>
    Engraving.Score.import(converted.candidate),
  );
  const reference = input.memoizedReference
    ? referenceMemoization(score)
    : undefined;
  const inputMeaningSha256 = reference
    ? sha(JSON.stringify(score.export()))
    : undefined;
  if (reference) {
    const original = score.toDocument;
    score.toDocument = function (...arguments_: unknown[]) {
      reference.beginDocument();
      return original.apply(this, arguments_);
    };
  }
  const controller = new Engraving.Controller(score, {
    scale: input.scale,
    layoutType: Sheet.LayoutType[input.layout],
    viewportWidth: input.viewport.width,
    viewportHeight: input.viewport.height,
    debug: false,
    advanced: true,
  });
  measure("mount", () => controller.mount());
  const drawing = measure("document", () => controller.toDocument());
  const modelMs = performance.now() - start;
  process.send?.({ modelComplete: { modelMs, modelStatus: "complete" } });
  const canonical = JSON.stringify(drawing);
  const dom = new JSDOM();
  Object.assign(globalThis, { document: dom.window.document });
  const svg = measure("svg", () =>
    drawing.pages
      .map(
        (_: unknown, pageIndex: number) =>
          drawing.toSVG({
            pageIndex,
            scale: input.scale,
            fontFamily: "Bravura",
            paddingBottom: input.layout === "Page" ? 0 : 100,
          }).outerHTML,
      )
      .join("\n"),
  );
  const result = {
    status: "complete",
    referenceVerification: reference?.verify(),
    inputUnchanged: reference
      ? inputMeaningSha256 === sha(JSON.stringify(score.export()))
      : undefined,
    modelMs,
    stages,
    documentSha256: sha(canonical),
    svgSha256: sha(svg),
    notes: score.notes.length,
    chords: score.chords.length,
    masterbars: score.masterbars.length,
    slots: score.slots.length,
    staves: score.staves.length,
    tracks: score.tracks.length,
    pages: drawing.pages.length,
    fixture: input.fixture.id,
    layout: input.layout,
    viewport: input.viewport,
    scale: input.scale,
  };
  if (input.referenceDirectory) {
    await mkdir(input.referenceDirectory, { recursive: true });
    const key = `${input.fixture.id}-${input.layout}-${input.viewport.width}x${input.viewport.height}-${input.scale}`;
    await writeFile(
      path.join(input.referenceDirectory, key + ".document.json.gz"),
      gzipSync(canonical),
    );
    await writeFile(
      path.join(input.referenceDirectory, key + ".svg.gz"),
      gzipSync(svg),
    );
  }
  dom.window.close();
  process.send?.({ result });
}
function summarize(results: Record<string, unknown>[]) {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const result of results) {
    const key = JSON.stringify([
      result.fixture,
      result.layout,
      result.viewport,
      result.scale,
    ]);
    const group = groups.get(key) ?? [];
    group.push(result);
    groups.set(key, group);
  }
  return [...groups].map(([condition, group]) => {
    const values = group
      .filter((r) => r.status === "complete")
      .map((r) => Number(r.modelMs))
      .toSorted((a, b) => a - b);
    const n = values.length;
    return {
      condition: JSON.parse(condition),
      trials: group.length,
      complete: n,
      cutoffs: group.filter((r) => r.status === "cutoff").length,
      failures: group.filter((r) => r.status === "error").length,
      maxMs: n ? values[n - 1] : null,
      medianMs: n
        ? (values[Math.floor((n - 1) / 2)] + values[Math.floor(n / 2)]) / 2
        : null,
    };
  });
}
if (process.argv[2] === "--child") {
  try {
    await child(JSON.parse(process.argv[3]));
  } catch (error) {
    const allowed = new Set([
      "REFERENCE_GETTER_MISSING",
      "REFERENCE_GETTER_CHANGED",
      "REFERENCE_PASS_REUSED",
      "REFERENCE_INPUT_MUTATION",
      "FIXTURE_HASH_MISMATCH",
      "PARTIAL_FIXTURE",
    ]);
    process.send?.({
      result: {
        status: "error",
        error:
          error instanceof Error && allowed.has(error.message)
            ? error.message
            : "RENDER_FAILED",
        errorType: error instanceof TypeError ? "TypeError" : "Error",
        location:
          error instanceof Error
            ? error.stack
                ?.split("\n")
                .slice(1)
                .map(
                  (line) =>
                    line.match(/(?:src|scripts)\/[^ )]+\.ts:\d+:\d+/)?.[0],
                )
                .filter(Boolean)
                .slice(0, 3)
            : undefined,
      },
    });
    process.exitCode = 1;
  } finally {
    process.disconnect?.();
  }
} else {
  const { values } = parseArgs({
    options: {
      manifest: { type: "string" },
      runs: { type: "string", default: "5" },
      output: { type: "string" },
      "source-root": { type: "string", default: process.cwd() },
      fixture: { type: "string" },
      offline: { type: "boolean", default: false },
      "first-condition": { type: "boolean", default: false },
      references: { type: "string" },
      "memoized-reference": { type: "boolean", default: false },
    },
  });
  if (!values.manifest || !values.output)
    throw new Error("--manifest and --output are required");
  if (values["memoized-reference"] && !values.offline)
    throw new Error("REFERENCE_CANNOT_MEASURE_PERFORMANCE");
  const manifest = JSON.parse(await readFile(values.manifest, "utf8"));
  const runs = Number(values.runs);
  if (!Number.isInteger(runs) || runs < 1) throw new Error("INVALID_RUNS");
  if (
    values.fixture &&
    !manifest.fixtures.some((f: { id: string }) => f.id === values.fixture)
  )
    throw new Error("UNKNOWN_FIXTURE");
  const root = path.resolve(values["source-root"]!);
  const results: Record<string, unknown>[] = [];
  const environment = {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    memoryBytes: os.totalmem(),
  };
  const sourceHashes: Record<string, string> = {};
  for (const name of [
    "src/s-core/models/sheet/score.ts",
    "src/s-core/models/sheet/controller.ts",
    "src/s-core/models/engraving/controller.ts",
    "src/s-core/models/engraving/extensions/to-document.ts",
    "src/s-core/models/document/extensions/to-svg.ts",
  ])
    sourceHashes[name] = sha(await readFile(path.join(root, name)));
  const manifestSha256 = sha(await readFile(values.manifest));
  if (
    sha(
      await readFile(path.join(root, "src/s-core/const/bravura/Bravura.woff")),
    ) !== manifest.fontSha256
  )
    throw new Error("FONT_HASH_MISMATCH");
  for (const fixture of manifest.fixtures.filter(
    (f: { id: string }) => !values.fixture || f.id === values.fixture,
  )) {
    const layouts = values["first-condition"]
      ? manifest.layouts.slice(0, 1)
      : manifest.layouts;
    const views = values["first-condition"]
      ? manifest.viewports.slice(0, 1)
      : manifest.viewports;
    const scales = values["first-condition"]
      ? manifest.scales.slice(0, 1)
      : manifest.scales;
    for (const layout of layouts)
      for (const viewport of views)
        for (const scale of scales)
          for (let run = 0; run < runs; run++) {
            const input: Input = {
              sourceRoot: root,
              fixture,
              layout,
              viewport,
              scale,
              referenceDirectory: values.references,
              memoizedReference: values["memoized-reference"],
            };
            const result = await new Promise<Record<string, unknown>>(
              (resolve) => {
                const worker = fork(
                  fileURLToPath(import.meta.url),
                  ["--child", JSON.stringify(input)],
                  {
                    cwd: root,
                    execArgv: ["--import", "tsx"],
                    silent: true,
                    env: {
                      ...process.env,
                      TSX_TSCONFIG_PATH: path.join(root, "tsconfig.json"),
                    },
                  },
                );
                worker.stdout?.resume();
                worker.stderr?.resume();
                let settled = false;
                let stage = "starting";
                const trialStartedNs = process.hrtime.bigint();
                let modelStartNs: bigint | undefined;
                let modelCompletion: Record<string, unknown> | undefined;
                let stageStartedNs: bigint | undefined;
                const completedStages: unknown[] = [];
                const cutoff = values.offline
                  ? manifest.offlineCutoffMs
                  : manifest.cutoffMs;
                const finish = (value: Record<string, unknown>) => {
                  if (settled) return;
                  settled = true;
                  clearTimeout(timer);
                  worker.kill("SIGKILL");
                  resolve({ completedStages, ...value });
                };
                const timer = setTimeout(
                  () =>
                    finish({
                      status: "cutoff",
                      cutoffMs: cutoff,
                      stage,
                      elapsedTrialMs:
                        Number(process.hrtime.bigint() - trialStartedNs) / 1e6,
                      modelLowerBoundMs:
                        modelStartNs && !modelCompletion
                          ? Number(process.hrtime.bigint() - modelStartNs) / 1e6
                          : null,
                      stageLowerBoundMs: stageStartedNs
                        ? Number(process.hrtime.bigint() - stageStartedNs) / 1e6
                        : null,
                      ...modelCompletion,
                    }),
                  cutoff,
                );
                worker.on(
                  "message",
                  (message: {
                    result?: Record<string, unknown>;
                    stage?: string;
                    status?: string;
                    measurement?: unknown;
                    startedNs?: string;
                    modelStartedNs?: string;
                    modelComplete?: Record<string, unknown>;
                  }) => {
                    if (message.modelStartedNs)
                      modelStartNs = BigInt(message.modelStartedNs);
                    if (message.modelComplete)
                      modelCompletion = message.modelComplete;
                    if (message.startedNs)
                      stageStartedNs = BigInt(message.startedNs);
                    if (message.measurement)
                      completedStages.push(message.measurement);
                    if (message.stage) {
                      stage = message.stage;
                      process.stderr.write(
                        `${fixture.id} ${layout} ${stage} ${message.status}\n`,
                      );
                    }
                    if (message.result) finish(message.result);
                  },
                );
                worker.on("error", () =>
                  finish({ status: "error", error: "CHILD_FAILURE", stage }),
                );
                worker.on("exit", () =>
                  finish({ status: "error", error: "CHILD_EXIT", stage }),
                );
              },
            );
            results.push({
              fixture: fixture.id,
              layout,
              viewport,
              scale,
              run: run + 1,
              ...result,
            });
            await mkdir(path.dirname(path.resolve(values.output)), {
              recursive: true,
            });
            await writeFile(
              values.output,
              JSON.stringify(
                {
                  measuredAt: new Date().toISOString(),
                  sourceRoot: root,
                  sourceHashes,
                  manifestSha256,
                  fontSha256: manifest.fontSha256,
                  environment,
                  measurementKind: values.offline
                    ? "offline-reference-excluded-from-performance"
                    : "model-cold",
                  runs,
                  results,
                  summary: summarize(results),
                },
                null,
                2,
              ) + "\n",
            );
            process.stderr.write(
              `${fixture.id} ${layout} run ${run + 1}: ${result.status}\n`,
            );
          }
  }
}
