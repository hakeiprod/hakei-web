import { expect, test } from "vitest";
import { Parser } from "./parser";
function midi(
  tracks: number[][],
  format = tracks.length === 1 ? 0 : 1,
  resolution = 480,
) {
  const header = [
    77,
    84,
    104,
    100,
    0,
    0,
    0,
    6,
    0,
    format,
    0,
    tracks.length,
    resolution >> 8,
    resolution & 255,
  ];
  return new Uint8Array([
    ...header,
    ...tracks.flatMap((track) => [
      77,
      84,
      114,
      107,
      (track.length >>> 24) & 255,
      (track.length >>> 16) & 255,
      (track.length >>> 8) & 255,
      track.length & 255,
      ...track,
    ]),
  ]);
}
test("per-track running status, velocity-zero note-off and power-of-two time signature are parsed", () => {
  const data = midi([
    [
      0, 255, 88, 4, 4, 2, 24, 8, 0, 144, 60, 90, 120, 62, 90, 120, 60, 0, 0,
      128, 62, 0, 0, 255, 47, 0,
    ],
  ]);
  const parsed = Parser.parse(data);
  expect(parsed.mtrks[0].events[0].event).toMatchObject({
    timeSignature: { numerator: 4, denominator: 4 },
  });
  expect(parsed.mtrks[0].events[2]).toMatchObject({
    statusByte: { type: 9, channel: 0 },
    event: { pitch: 62, velocity: 90 },
  });
  const badSecond = midi([
    [0, 144, 60, 90, 0, 255, 47, 0],
    [0, 60, 90, 0, 255, 47, 0],
  ]);
  expect(() => Parser.parse(badSecond)).toThrow();
});
test("variable-length metadata is bounded and truncated chunks are rejected", () => {
  const text = Array.from({ length: 130 }, () => 65);
  const data = midi([[0, 255, 3, 129, 2, ...text, 0, 255, 47, 0]]);
  expect(Parser.parse(data).mtrks[0].events[0].event).toMatchObject({
    trackName: "A".repeat(130),
  });
  expect(() => Parser.parse(data.slice(0, -1))).toThrow();
  expect(() => Parser.parse(midi([[0, 255, 3, 127, 65]]))).toThrow();
});
test("format 2, SMPTE and running status after a meta event are outside the accepted grammar", () => {
  expect(() => Parser.parse(midi([[0, 255, 47, 0]], 2))).toThrow(
    "UNSUPPORTED_FORMAT",
  );
  expect(() => Parser.parse(midi([[0, 255, 47, 0]], 0, 0xe7_28))).toThrow(
    "UNSUPPORTED_FORMAT",
  );
  expect(() =>
    Parser.parse(
      midi([[0, 144, 60, 90, 0, 255, 1, 0, 0, 60, 0, 0, 255, 47, 0]]),
    ),
  ).toThrow();
});

test("conversion keeps channels separate and retains fractional MIDI tempo", async () => {
  const { toCore } = await import("./extensions/to-core");
  const parsed = Parser.parse(
    midi([
      [
        0, 255, 81, 3, 7, 161, 33, 0, 144, 60, 90, 0, 145, 60, 80, 120, 128, 60,
        0, 120, 129, 60, 0, 0, 255, 47, 0,
      ],
    ]),
  );
  const score = toCore(parsed);
  expect(
    score.notes.map((note) => [note.channel, note.start.value, note.end.value]),
  ).toEqual([
    [0, 0, 0.25],
    [1, 0, 0.5],
  ]);
  expect(score.tempos[0].value.value).toBe(60_000_000 / 500_001);
  expect(score.tracks[0].sourceTrack).toBe(0);
});
