import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { sheetScoreSchema } from "../../import/score-schema";
import { capabilities } from "./capabilities";
import { fixtureTimeline } from "../../fixtures/timeline";
import { performanceNotes } from "./performance-events";
import { Score } from "..";
import "../extensions/to-audio";
test("explicit paired displays produce one attack and ambiguous unisons are not guessed", async () => {
  const data = JSON.parse(
    await readFile(
      "src/s-core/fixtures/tab-drum/mixed/explicit-shared-event.json",
      "utf8",
    ),
  );
  const valid = sheetScoreSchema.parse(data);
  expect(valid.notes).toHaveLength(2);
  expect(performanceNotes(valid.notes)).toHaveLength(1);
  expect(fixtureTimeline(valid).notes).toHaveLength(1);
  delete data.notes[0].performanceEventId;
  expect(sheetScoreSchema.safeParse(data).success).toBe(false);
  delete data.notes[1].performanceEventId;
  expect(capabilities(data).canRender).toBe(true);
  expect(capabilities(data).canPlayback).toBe(false);
  expect(performanceNotes(data.notes)).toHaveLength(2);
});

test("shared tied events keep their duration regardless of display note order", async () => {
  const base = sheetScoreSchema.parse(
    JSON.parse(
      await readFile(
        "src/s-core/fixtures/tab-drum/mixed/explicit-shared-event.json",
        "utf8",
      ),
    ),
  );
  const lead = base.notes.map((note) => ({
    ...note,
    ties: ["start" as const],
  }));
  const stop = base.notes.map((note) => ({
    ...note,
    id: note.id + 2,
    start: 1,
    end: 2,
    performanceEventId: "shared-stop",
    ties: ["stop" as const],
  }));
  for (const notes of [
    [...lead, ...stop],
    [...lead, ...stop.toReversed()],
    [...lead.toReversed(), ...stop],
  ]) {
    const score = sheetScoreSchema.parse({ ...base, notes });
    const timeline = fixtureTimeline(score);
    expect(timeline.notes).toHaveLength(1);
    expect(timeline.notes[0].durationUs).toBe(1_000_000);
    expect(timeline.continuations[0].continuedFrom).toBe("0:0");
    expect(performanceNotes(score.notes).map((note) => note.staveId)).toEqual([
      0, 0,
    ]);
    expect(score.notes).toHaveLength(4);
    // Exercise the saved JSON boundary before audio conversion.
    // eslint-disable-next-line unicorn/prefer-structured-clone
    const audio = Score.import(JSON.parse(JSON.stringify(score))).toAudio();
    expect(audio.notes.map((note) => note.id)).toEqual([0, 2]);
  }
});
