import { expect, test } from "vitest";
import * as Core from "../../core";
import "../../core/extensions/to-sheet";
import "./to-audio";
import { drainCooperatively } from "../../browser/render-scheduler";

test("cooperative audio preparation preserves the synchronous musical export and yields within note creation", async () => {
  const score = Core.Score.create({
    tracks: [
      {
        notes: [
          { pitch: 60, start: 0, duration: 1 },
          { pitch: 64, start: 1, duration: 1 },
        ],
      },
    ],
  }).toSheet();
  const expected = score.toAudio().export();
  const actual = await drainCooperatively(score.toAudioSteps());
  expect(actual.export()).toEqual(expected);
  expect(
    actual.notes.map((note) => [
      note.pitch.value,
      note.start.value,
      note.duration.value,
    ]),
  ).toEqual([
    [60, 0, 1],
    [64, 1, 1],
  ]);
});
