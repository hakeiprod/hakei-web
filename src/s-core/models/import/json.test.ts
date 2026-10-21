import { expect, it } from "vitest";
import { convertJson } from "./json";
const input = {
  tracks: [
    { name: "Piano", preset: 0, notes: [{ pitch: 60, start: 0, duration: 1 }] },
  ],
};
it("recognizes Core parameters and does not mutate defaults into the original", () => {
  const result = convertJson(input);
  expect(result.format).toBe("CORE_JSON");
  expect(
    result.candidate.notes.some((note) => note.pitch === 60 && !note.rest),
  ).toBe(true);
  expect(
    result.issues.filter((issue) => issue.code.startsWith("DEFAULT_")).length,
  ).toBe(3);
  expect(input).toEqual({
    tracks: [
      {
        name: "Piano",
        preset: 0,
        notes: [{ pitch: 60, start: 0, duration: 1 }],
      },
    ],
  });
});
it("recognizes complete Sheet exports without changing music", () => {
  const original = convertJson(input).candidate;
  const result = convertJson(original);
  expect(result.format).toBe("SHEET_JSON");
  expect(result.candidate).toEqual(original);
});
it("rejects mixed or arbitrary JSON and incomplete duration information", () => {
  expect(() => convertJson({ hello: "world" })).toThrow();
  expect(() => convertJson({ ...input, notes: [] })).toThrow();
  expect(() =>
    convertJson({ tracks: [{ notes: [{ pitch: 60, start: 0 }] }] }),
  ).toThrow();
});
