/* Normalize parser/model data through the actual JSON transport boundary. */
/* eslint-disable unicorn/prefer-structured-clone */
import { expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { convertScore } from "./convert";
import { promotePartial } from "./promote-partial";
import { Score } from "../sheet";
for (const version of ["2.0", "3.0", "3.1", "4.0"])
  test(`unpitched notation ${version} stays independent of instrument pitch`, async () => {
    const input = await readFile(
      "src/s-core/fixtures/tab-drum/drums/snare.musicxml",
      "utf8",
    );
    const source = input.replace('version="4.0"', `version="${version}"`);
    const result = await convertScore({
      bytes: new TextEncoder().encode(source),
      options: { mode: "PRESERVE" },
    });
    expect(result.candidate.notes[0]).toMatchObject({
      pitch: null,
      percussion: {
        midiNote: 38,
        midiChannel: 9,
        displayStep: "C",
        displayOctave: 5,
      },
    });
    expect(result.validation.canPractice).toBe(false);
    expect(result.issues.some((index) => index.code === "MISSING_PITCH")).toBe(
      false,
    );
  });
test("rest null stays a rest through promotion and model transport", async () => {
  const result = await convertScore({
    bytes: await readFile(
      "src/s-core/fixtures/tab-drum/drums/rest-null-quarter.musicxml",
    ),
    options: { mode: "PRESERVE" },
  });
  expect(result.candidate.notes[0]).toMatchObject({ pitch: null, rest: true });
  expect(result.candidate.notes[0].percussion).toBeUndefined();
  if ("format" in result.candidate)
    throw new Error("Expected complete notation");
  const full = result.candidate;
  const partial = {
    format: "converted-partial-v1",
    tracks: full.tracks.map(({ id, name, preset }) => ({ id, name, preset })),
    notes: full.notes.map((n) => ({
      id: String(n.id),
      trackId: n.trackId,
      staveId: n.staveId,
      chordId: n.chordId,
      pitch: n.pitch,
      onset: n.start,
      duration: n.duration,
      velocity: n.velocity,
      rest: n.rest,
      voice: n.voice,
    })),
    notation: { ...full, notes: undefined },
    tempos: full.tempos.map(({ start, value }) => ({ start, value })),
    timesignatures: full.timesignatures.map(
      ({ start, numerator, denominator }) => ({
        start,
        numerator,
        denominator,
      }),
    ),
    keysignatures: full.keysignatures.map(
      ({ start, accidental, tonality }) => ({ start, accidental, tonality }),
    ),
  };
  const candidate = promotePartial(
    JSON.parse(JSON.stringify(partial)),
  ).candidate;
  expect(candidate.notes[0]).toMatchObject({ pitch: null, rest: true });
  expect("format" in candidate).toBe(false);
  expect(
    Score.import(candidate as unknown as ReturnType<Score["export"]>).export()
      .notes[0].pitch,
  ).toBeNull();
});
