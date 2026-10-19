// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { convertMusicXml } from "./musicxml";
const fixture = () => readFile("src/s-core/fixtures/import/quarter.musicxml");
it("accepts the standard external DOCTYPE without fetching it", async () => {
  const result = await convertMusicXml(await fixture());
  expect(result.candidate.notes[0]).toMatchObject({
    pitch: 60,
    start: 0,
    duration: 1,
  });
  expect(result.issues.some((issue) => issue.severity === "BLOCKING")).toBe(
    false,
  );
});
it("rejects entities, unsupported versions, roots and malformed XML", async () => {
  for (const text of [
    '<!DOCTYPE score-partwise [<!ENTITY secret SYSTEM "file:///etc/passwd">]><score-partwise version="4.0">&secret;</score-partwise>',
    '<score-partwise version="4.1"/>',
    '<score-timewise version="4.0"/>',
    '<score-partwise version="4.0">',
  ])
    await expect(
      convertMusicXml(new TextEncoder().encode(text)),
    ).rejects.toThrow();
});
it("keeps a repeat as a playback blocker", async () => {
  const original = await fixture();
  const text = original
    .toString()
    .replace(
      "</measure>",
      '<barline><repeat direction="backward"/></barline></measure>',
    );
  const result = await convertMusicXml(new TextEncoder().encode(text));
  expect(
    result.issues.some(
      (issue) =>
        issue.code === "UNSUPPORTED_REPEAT" && issue.severity === "BLOCKING",
    ),
  ).toBe(true);
});
it("does not advance the cursor for chord members and supports backup voices", async () => {
  const original = await fixture();
  const text = original
    .toString()
    .replace(
      "</measure>",
      "<note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note><backup><duration>1</duration></backup><note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><voice>2</voice></note></measure>",
    );
  const result = await convertMusicXml(new TextEncoder().encode(text));
  expect(
    result.candidate.notes
      .filter((note) => !note.rest)
      .map((note) => [
        note.pitch,
        "start" in note ? note.start : note.onset,
        note.duration,
      ]),
  ).toEqual([
    [60, 0, 1],
    [64, 0, 1],
    [67, 0, 1],
  ]);
});
it("retains triplet durations, explicit note type and tie continuation", async () => {
  const original = await fixture();
  const text = original
    .toString()
    .replace("<divisions>1</divisions>", "<divisions>3</divisions>")
    .replace(
      "<type>quarter</type>",
      '<type>eighth</type><tie type="stop"/><time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>',
    );
  const result = await convertMusicXml(new TextEncoder().encode(text));
  expect(result.candidate.notes[0]).toMatchObject({
    duration: 1 / 3,
    notatedType: { _: "eighth" },
    notatedDots: 0,
    ties: ["stop"],
  });
});
it("integrates direction offsets and metronome beat units", async () => {
  const original = await fixture();
  const text = original
    .toString()
    .replace(
      '<direction><sound tempo="120"/></direction>',
      "<direction><direction-type><metronome><beat-unit>eighth</beat-unit><per-minute>120</per-minute></metronome></direction-type><offset>1</offset></direction>",
    );
  const result = await convertMusicXml(new TextEncoder().encode(text));
  expect(
    result.candidate.tempos.map((tempo) => [tempo.start, tempo.value]),
  ).toEqual([
    [0, 120],
    [1, 60],
  ]);
});
