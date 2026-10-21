import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { atomicReport, fixtureSuite } from "./lib/notation-report";
import { reportSchema } from "../src/s-core/models/fixtures/manifest";
const suiteIndex = process.argv.indexOf("--suite");
if (
  suiteIndex !== -1 &&
  (!process.argv[suiteIndex + 1] ||
    process.argv[suiteIndex + 1].startsWith("--"))
)
  throw new Error("Missing fixture suite");
const suite = fixtureSuite(
  suiteIndex === -1 ? undefined : process.argv[suiteIndex + 1],
);
const directory = await mkdtemp(path.join(tmpdir(), "notation-verification-"));
let code = 0;
try {
  const tests = [suite.test];
  const run = (arguments_: string[]) =>
    spawnSync(
      process.execPath,
      ["node_modules/vitest/vitest.mjs", "run", ...arguments_],
      {
        stdio: "inherit",
        env: { ...process.env, NOTATION_REPORT_DIR: directory },
      },
    ).status ?? 1;
  code = run(tests);
  if (process.argv.includes("--persisted")) {
    const build =
      spawnSync(process.execPath, ["scripts/build-import-worker.mjs"], {
        stdio: "inherit",
      }).status ?? 1;
    code ||= build;
    if (build === 0) {
      const integrationCode = run([
        "--config",
        "vitest.integration.config.mts",
        suite.integration,
      ]);
      if (integrationCode !== 0) code = integrationCode;
    }
  }
  const entries = await readdir(directory);
  const runs = await Promise.all(
    entries
      .filter((name) => name.endsWith(".json"))
      .map(async (name) =>
        JSON.parse(await readFile(path.join(directory, name), "utf8")),
      ),
  );
  await atomicReport(
    path.join(suite.reportDirectory, "verification-results.json"),
    reportSchema.parse({ version: 1, runs }),
  );
  console.log(`Recorded ${runs.length} fixture runs; exit=${code}`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
process.exitCode = code;
