import path from "node:path";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import * as Midi from "../../../models/files/standard-midi-file";
import { importCore } from "../..";
const importMidi = (fileName: string) =>
  Midi.toCore(
    Midi.parse(
      readFileSync(
        path.join(
          "src",
          "s-core",
          "fixtures",
          "files",
          "standard-midi-file",
          `${fileName}.mid`
        )
      ).toArrayBuffer()
    )
  );

test("quarter_middle_c", async () =>
  expect(importMidi(`quarter_middle_c`)).toEqual(
    await importCore("quarter_middle_c")
  ));
test("quarter_rest", async () =>
  expect(importMidi(`quarter_rest`)).toEqual(await importCore("quarter_rest")));
test("8th_middle_c", async () =>
  expect(importMidi("8th_middle_c")).toEqual(await importCore("8th_middle_c")));
test("8th_rest", async () =>
  expect(importMidi("8th_rest")).toEqual(await importCore("8th_rest")));
test("beat_4", async () =>
  expect(importMidi("beat_4")).toEqual(await importCore("beat_4")));
test("bpm_120", async () =>
  expect(importMidi("bpm_120")).toEqual(await importCore("bpm_120")));
test("bpm_140", async () =>
  expect(importMidi("bpm_140")).toEqual(await importCore("bpm_140")));
test("c_major", async () =>
  expect(importMidi("c_major")).toEqual(await importCore("c_major")));
test("c_minor", async () =>
  expect(importMidi("c_minor")).toEqual(await importCore("c_minor")));
test("c_major_chord", async () =>
  expect(importMidi("c_major_chord")).toEqual(
    await importCore("c_major_chord")
  ));
test("quarter_dot_middle_c", async () =>
  expect(importMidi(`quarter_dot_middle_c`)).toEqual(
    await importCore("quarter_dot_middle_c")
  ));
test("two-tracks", async () =>
  expect(importMidi(`two_tracks`)).toEqual(await importCore("two_tracks")));
test("timesignature_3_4", async () =>
  expect(importMidi(`timesignature_3_4`)).toEqual(
    await importCore("timesignature_3_4")
  ));
test("timesignature_4_4_to_3_4", async () =>
  expect(importMidi(`timesignature_4_4_to_3_4`)).toEqual(
    await importCore("timesignature_4_4_to_3_4")
  ));
test("timesignature_4_4", async () =>
  expect(importMidi(`timesignature_4_4`)).toEqual(
    await importCore("timesignature_4_4")
  ));
test("two_tracks", async () =>
  expect(importMidi(`two_tracks`)).toEqual(await importCore("two_tracks")));
