/** Byte-exact reference validation. No coordinate rounding or SVG normalization. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { parseArgs } from "node:util";
const { values } = parseArgs({
  options: Object.fromEntries(
    [
      "original",
      "memoized",
      "manifest",
      "source-manifest",
      "original-artifacts",
      "memoized-artifacts",
      "output",
    ].map((name) => [name, { type: "string" }]),
  ),
});
for (const name of [
  "original",
  "memoized",
  "manifest",
  "source-manifest",
  "original-artifacts",
  "memoized-artifacts",
  "output",
])
  if (!values[name]) throw new Error(`Missing --${name}`);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJSON = async (file) => JSON.parse(await readFile(file, "utf8"));
const [original, memoized, manifest, source] = await Promise.all(
  [
    values.original,
    values.memoized,
    values.manifest,
    values["source-manifest"],
  ].map(readJSON),
);
for (const [name, hash] of Object.entries(source.sourceSha256))
  if (sha(await readFile(path.join(source.sourceRoot, name))) !== hash)
    throw new Error("FROZEN_SOURCE_CHANGED");
for (const fixture of manifest.fixtures)
  if (
    sha(await readFile(path.join(source.sourceRoot, fixture.path))) !==
    fixture.sha256
  )
    throw new Error("FROZEN_INPUT_CHANGED");
if (
  sha(await readFile(path.join(source.sourceRoot, source.fontPath))) !==
  source.fontSha256
)
  throw new Error("FROZEN_FONT_CHANGED");
const key = (item) =>
  `${item.fixture}-${item.layout}-${item.viewport.width}x${item.viewport.height}-${item.scale}`;
const expected = new Set();
for (const fixture of manifest.fixtures)
  for (const layout of manifest.layouts)
    for (const viewport of manifest.viewports)
      for (const scale of manifest.scales)
        expected.add(key({ fixture: fixture.id, layout, viewport, scale }));
const index = (data) => {
  const items = new Map();
  for (const result of data.results) {
    const name = key(result);
    if (items.has(name) || !expected.has(name) || result.status !== "complete")
      throw new Error("INVALID_OR_INCOMPLETE_RESULT");
    items.set(name, result);
  }
  if (items.size !== expected.size) throw new Error("MISSING_CONDITIONS");
  return items;
};
const before = index(original),
  after = index(memoized),
  comparisons = [];
for (const name of expected) {
  const a = before.get(name),
    b = after.get(name);
  if (
    !b.inputUnchanged ||
    !(b.referenceVerification?.verifiedGetters > 0) ||
    !(b.referenceVerification?.guardedObjects > 0)
  )
    throw new Error("MISSING_IMMUTABILITY_PROOF");
  for (const field of ["documentSha256", "svgSha256", "notes", "pages"])
    if (a[field] !== b[field])
      throw new Error(`REFERENCE_MISMATCH:${name}:${field}`);
  for (const [suffix, field] of [
    [".document.json.gz", "documentSha256"],
    [".svg.gz", "svgSha256"],
  ]) {
    const [first, second] = await Promise.all(
      [values["original-artifacts"], values["memoized-artifacts"]].map(
        async (directory) =>
          gunzipSync(await readFile(path.join(directory, name + suffix))),
      ),
    );
    if (
      !first.equals(second) ||
      sha(first) !== a[field] ||
      sha(second) !== b[field]
    )
      throw new Error("ARTIFACT_MISMATCH");
  }
  comparisons.push({
    condition: name,
    documentSha256: a.documentSha256,
    svgSha256: a.svgSha256,
    notes: a.notes,
    pages: a.pages,
    inputUnchanged: true,
    ...b.referenceVerification,
    equal: true,
  });
}
const report = {
  measuredAt: new Date().toISOString(),
  status: "equal",
  conditions: comparisons.length,
  normalization: "none; decompressed byte equality",
  performancePass: null,
  purpose:
    "reference equivalence only; one trial is not the T005 five-run baseline",
  sourceSha256: source.sourceSha256,
  fontSha256: source.fontSha256,
  inputRecords: await Promise.all(
    [values.original, values.memoized, values.manifest].map(async (file) => ({
      name: path.basename(file),
      sha256: sha(await readFile(file)),
    })),
  ),
  comparisons,
};
await mkdir(path.dirname(path.resolve(values.output)), { recursive: true });
await writeFile(values.output, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({ status: report.status, conditions: report.conditions }),
);
