import { createHash, randomUUID } from "node:crypto";
import {
  readFile,
  readdir,
  mkdir,
  writeFile,
  rename,
  rm,
  realpath,
} from "node:fs/promises";
import path from "node:path";
import { canonical } from "../../src/s-core/models/fixtures/evaluate";
import type {
  FixtureDefinition,
  VerificationRun,
} from "../../src/s-core/models/fixtures/manifest";
export const fixtureRoot = path.resolve("src/s-core/fixtures");
export function fixtureSuite(name = "notation") {
  if (!["notation", "tab-drum"].includes(name))
    throw new Error("Unknown fixture suite");
  return {
    name,
    manifest: `${name}/manifest.json`,
    reportDirectory: path.resolve(
      "specs",
      name === "notation"
        ? "008-extend-score-notation"
        : "009-tab-drum-notation",
    ),
    test: `src/s-core/models/fixtures/${name}.test.ts`,
    integration: `src/server/score-${name === "notation" ? "notation" : "tab-drum"}.integration.test.ts`,
  };
}
export const reportDirectory = fixtureSuite().reportDirectory;
export function sha256(data: string | Uint8Array) {
  return createHash("sha256").update(data).digest("hex");
}
export function fixtureIdentity(
  bytes: Uint8Array,
  definition: unknown,
  revision: string,
) {
  return {
    sourceHash: sha256(bytes),
    expectationHash: sha256(canonical(definition)),
    rendererRevision: revision,
  };
}
export async function readFixture(relative: string, root = fixtureRoot) {
  const base = await realpath(root);
  const file = await realpath(path.resolve(base, relative));
  if (!file.startsWith(base + path.sep))
    throw new Error("Fixture path escapes root");
  return new Uint8Array(await readFile(file));
}
export async function rendererRevision(root = process.cwd()) {
  const paths = [
    "src/s-core/models",
    "src/s-core/const",
    "src/components",
    "src/app",
    "package-lock.json",
    "tsconfig.json",
  ];
  const files: string[] = [];
  async function collect(relative: string) {
    try {
      const list = await readdir(path.join(root, relative), {
        withFileTypes: true,
      });
      for (const item of list) {
        const name = `${relative}/${item.name}`;
        if (item.isDirectory()) await collect(name);
        else if (item.isFile()) files.push(name);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOTDIR")
        files.push(relative);
      else if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  for (const relative of paths) await collect(relative);
  const hash = createHash("sha256");
  for (const file of files.toSorted()) {
    const bytes = await readFile(path.join(root, file));
    hash.update(canonical([file, bytes.length]));
    hash.update(bytes);
  }
  return hash.digest("hex");
}
export async function atomicReport(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2) + "\n");
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}
export function createRun(
  fixture: FixtureDefinition,
  bytes: Uint8Array,
  revision: string,
  results: VerificationRun["results"],
): VerificationRun {
  return {
    runId: randomUUID(),
    fixtureId: fixture.id,
    ...fixtureIdentity(bytes, fixture, revision),
    layout: fixture.layout ?? null,
    executedAt: new Date().toISOString(),
    results,
  };
}
