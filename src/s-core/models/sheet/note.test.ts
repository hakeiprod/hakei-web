import { expect, it } from "vitest";
import * as Core from "../core";
import * as Sheet from ".";
function note(duration: number) {
  return Core.Score.create({
    tracks: [{ notes: [{ pitch: 60, start: 0, duration }] }],
  })
    .toSheet()
    .notes.find((note) => !note.rest)!;
}
it("does not represent triplets as dozens of augmentation dots", () => {
  expect(note(1 / 3).dot).toBe(0);
});
it("recognizes ordinary dotted durations and preserves explicit notation", () => {
  expect(note(1.5).dot).toBe(1);
  expect(note(1.75).dot).toBe(2);
  const data = note(1 / 3).export();
  const imported = Sheet.Note.import({
    ...data,
    notatedType: { _: "eighth" },
    notatedDots: 0,
  });
  expect(imported.type._).toBe("eighth");
  expect(imported.dot).toBe(0);
  expect(imported.export()).toMatchObject({
    notatedType: { _: "eighth" },
    notatedDots: 0,
  });
});
