// @vitest-environment node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { Importer } from "../browser/importer";
import { convertScore } from "./convert";
import manifest from "../../fixtures/import/musicxml-compatibility.json";

const name = "naitoobunaitsu-bitomario.mxl";
const original = `src/s-core/fixtures/files/musicxml/${name}`;
// Independently calculated from score.xml using Python's ElementTree, not the importer.
// Tuple: track, MIDI pitch/null, onset in quarter beats, duration, voice, zero-based staff, rest.
const musicalHash =
  "e7a094b9a0f50e280e02c18ed67ffd64d8472e642564f015c77b00ecb7875cfc";
function semanticHash(
  notes: {
    trackId: number;
    pitch: number | null;
    start: number;
    duration: number;
    voice?: number;
    staveId?: number;
    rest?: boolean;
  }[],
) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        notes.map((note) => [
          note.trackId,
          note.rest ? null : note.pitch,
          note.start,
          note.duration,
          note.voice,
          note.staveId,
          note.rest,
        ]),
      ),
    )
    .digest("hex");
}

it("preserves the actual 3.1 file and all 5,540 independent note values", async () => {
  expect(manifest.independent).toContainEqual({
    file: name,
    version: "3.1",
    test: "src/s-core/models/import/naitoobunaitsu.test.ts",
  });
  const bytes = await readFile(original);
  expect(bytes.byteLength).toBe(57_952);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    "1d15dcf279b2de186682740fbdfb501eb5e2e80f5977993cde04f1027b9f36fe",
  );
  const result = await convertScore({
    bytes,
    sourceName: name,
    options: { mode: "PRESERVE" },
  });
  expect(result.metadata).toMatchObject({
    format: "MUSICXML",
    formatVersion: "3.1",
    sourceName: name,
  });
  if ("format" in result.candidate)
    throw new Error("Expected a complete Sheet candidate");
  const data = result.candidate;
  expect(data.notes).toHaveLength(5540);
  expect(data.chords).toHaveLength(5346);
  expect(
    data.notes
      .flatMap((note) => note.ties ?? [])
      .filter((tie) => tie === "start"),
  ).toHaveLength(196);
  expect(
    data.notes
      .flatMap((note) => note.ties ?? [])
      .filter((tie) => tie === "stop"),
  ).toHaveLength(196);
  expect(semanticHash(data.notes)).toBe(musicalHash);
  expect(data.tracks.map((track) => [track.start, track.end])).toEqual([
    [0, 576.5],
    [0, 576.5],
  ]);
  expect(data.masterbars).toHaveLength(145);
  expect(data.masterbars[0]).toMatchObject({
    start: 0,
    duration: 0.5,
    end: 0.5,
  });
  expect(data.staves).toHaveLength(580);
  expect(data.tempos.map((tempo) => [tempo.start, tempo.value])).toEqual([
    [0, 60],
    [0.5, 180],
  ]);
  expect(
    data.timesignatures.map((meter) => [
      meter.start,
      meter.numerator,
      meter.denominator,
    ]),
  ).toEqual([[0, 4, 4]]);
  expect(
    data.keysignatures.map((key) => [key.start, key.accidental, key.tonality]),
  ).toEqual([[0, -1, 0]]);
  expect(result.issues).toHaveLength(312);
  expect(
    result.issues.every(
      (issue) =>
        issue.code === "DISPLAY_INFORMATION_OMITTED" &&
        issue.severity === "WARNING",
    ),
  ).toBe(true);
  expect(result.validation).toMatchObject({
    canPractice: true,
    canGame: true,
    unresolvedIssueIds: [],
  });
}, 30_000);

it("keeps the original musical values through browser Importer and JSON transport", async () => {
  const bytes = await readFile(original);
  const sheet = await new Importer().import(
    new File([new Uint8Array(bytes)], name),
  );
  // eslint-disable-next-line unicorn/prefer-structured-clone
  const data = JSON.parse(JSON.stringify(sheet.export()));
  expect(data.notes).toHaveLength(5540);
  expect(data.slots).toHaveLength(1497);
  expect(semanticHash(data.notes)).toBe(musicalHash);
}, 30_000);
