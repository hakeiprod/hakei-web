// @vitest-environment node
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { convertScore } from "./convert";
import { convertMusicXml } from "./musicxml";
import expected from "../../fixtures/import/musicxml-versions/expected.json";
const directory = "src/s-core/fixtures/import/musicxml-versions/";
const fixture = () => readFile(directory + "study-4.0.musicxml", "utf8");
const bytes = (value: string) => new TextEncoder().encode(value);
describe.each(["2.0", "3.0", "3.1", "4.0"])("MusicXML %s", (version) => {
  it.each(["musicxml", "mxl"])(
    "preserves the source version and musical meaning from %s",
    async (extension) => {
      const result = await convertScore({
        bytes: await readFile(`${directory}study-${version}.${extension}`),
        sourceName: `study-${version}.${extension}`,
        options: { mode: "PRESERVE" },
      });
      expect(result.metadata).toMatchObject({
        format: "MUSICXML",
        formatVersion: version,
        converterVersion: "score-import-v4",
      });
      expect(result.canPractice).toBe(true);
      expect(
        result.candidate.notes.map((note) => [
          note.pitch,
          "start" in note ? note.start : note.onset,
          note.duration,
          note.voice,
          note.staveId,
        ]),
      ).toEqual(expected.notes);
      expect(result.candidate.tempos.map((t) => [t.start, t.value])).toEqual(
        expected.tempos,
      );
      expect(
        result.candidate.timesignatures.map((t) => [
          t.start,
          t.numerator,
          t.denominator,
        ]),
      ).toEqual(expected.meters);
      expect(
        result.candidate.keysignatures.map((t) => [
          t.start,
          t.accidental,
          t.tonality,
        ]),
      ).toEqual(expected.keys);
      expect(result.candidate.notes[0].chordId).toBe(
        result.candidate.notes[1].chordId,
      );
      expect(result.candidate.notes[4].ties).toEqual(["start"]);
      expect(result.candidate.notes[5].ties).toEqual(["stop"]);
      expect(result.candidate.notes[6].rest).toBe(true);
    },
  );
});
it.each([undefined, "1.0", "4.1", "next"])(
  "rejects unsupported/missing version %s distinctly",
  async (version) => {
    const original = await fixture();
    const source = original
      .replace(/<!DOCTYPE[\s\S]*?>/, "")
      .replace(
        ' version="4.0"',
        version === undefined ? "" : ` version="${version}"`,
      );
    await expect(convertMusicXml(bytes(source))).rejects.toThrow(
      "UNSUPPORTED_MUSICXML_VERSION",
    );
  },
);
it.each(["score-timewise", "opus"])(
  "rejects unsupported structure %s distinctly",
  async (root) => {
    const original = await fixture();
    const source = original
      .replace(/<!DOCTYPE[\s\S]*?>/, "")
      .replaceAll("score-partwise", root);
    await expect(convertMusicXml(bytes(source))).rejects.toThrow(
      "UNSUPPORTED_MUSICXML_STRUCTURE",
    );
  },
);
it("handles ordinary external DOCTYPE offline and rejects contradictory declarations and entities", async () => {
  const fetcher = vi.fn(() => {
    throw new Error("network forbidden");
  });
  vi.stubGlobal("fetch", fetcher);
  try {
    const source = await fixture();
    await expect(convertMusicXml(bytes(source))).resolves.toHaveProperty(
      "formatVersion",
      "4.0",
    );
    await expect(
      convertMusicXml(
        bytes(
          source.replace(
            /<!DOCTYPE[\s\S]*?>/,
            `<!DOCTYPE score-partwise SYSTEM 'https://example.invalid/partwise.dtd'>`,
          ),
        ),
      ),
    ).resolves.toHaveProperty("formatVersion", "4.0");
    await expect(
      convertMusicXml(
        bytes(source.replace("MusicXML 4.0 Partwise", "MusicXML 3.1 Partwise")),
      ),
    ).rejects.toThrow("INVALID_XML_DOCTYPE");
    await expect(
      convertMusicXml(
        bytes(
          source.replace(
            /<!DOCTYPE[\s\S]*?>/,
            `<!DOCTYPE score-partwise [<!ENTITY e SYSTEM "file:///secret">]>`,
          ),
        ),
      ),
    ).rejects.toThrow("XML_ENTITY_FORBIDDEN");
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
it.each(["0", "-1", "invalid", "Infinity"])(
  "rejects invalid tempo %s rather than defaulting",
  async (value) => {
    const original = await fixture();
    const source = original.replace('tempo="90"', `tempo="${value}"`);
    await expect(convertMusicXml(bytes(source))).rejects.toThrow(
      "INVALID_XML_TEMPO",
    );
  },
);
it("warns on missing settings but blocks valid uninterpretable settings", async () => {
  const source = await fixture();
  const missing = source.replaceAll(/<direction>[\s\S]*?<\/direction>/g, "");
  const result = await convertScore({
    bytes: bytes(missing),
    options: { mode: "PRESERVE" },
  });
  expect(
    result.issues.some(
      (index) => index.code === "DEFAULT_TEMPO" && index.severity === "WARNING",
    ),
  ).toBe(true);
  expect(result.canPractice).toBe(true);
  const unknown = source.replace(
    "<key><fifths>1</fifths><mode>major</mode></key>",
    "<key><key-step>C</key-step><key-alter>1</key-alter></key>",
  );
  const blocked = await convertScore({
    bytes: bytes(unknown),
    options: { mode: "PRESERVE" },
  });
  expect(
    blocked.issues.some(
      (index) =>
        index.code === "UNSUPPORTED_KEY" && index.severity === "BLOCKING",
    ),
  ).toBe(true);
  expect(blocked.canPractice).toBe(false);
});
it.each(["key", "meter"])("rejects out-of-range %s settings", async (kind) => {
  const original = await fixture();
  const source = original.replace(
    kind === "key" ? "<fifths>1</fifths>" : "<beats>3</beats>",
    kind === "key" ? "<fifths>8</fifths>" : "<beats>0</beats>",
  );
  await expect(convertMusicXml(bytes(source))).rejects.toThrow(
    kind === "key" ? "INVALID_XML_KEY" : "INVALID_XML_METER",
  );
});
it("does not silently discard unsupported harmony or transpose instructions", async () => {
  const original = await fixture();
  const source = original
    .replace(
      "</attributes>",
      "<transpose><diatonic>1</diatonic><chromatic>2</chromatic></transpose></attributes>",
    )
    .replace(
      "</measure>",
      "<harmony><function>V</function></harmony></measure>",
    );
  const result = await convertScore({
    bytes: bytes(source),
    options: { mode: "PRESERVE" },
  });
  expect(
    result.issues.some(
      (index) =>
        index.code === "DISPLAY_INFORMATION_OMITTED" &&
        index.severity === "WARNING",
    ),
  ).toBe(true);
  expect(
    result.issues.some(
      (index) =>
        index.code === "UNSUPPORTED_TRANSPOSE" && index.severity === "BLOCKING",
    ),
  ).toBe(true);
  expect(result.canGame).toBe(false);
});

it.each(["0", "-5", "bad"])(
  "rejects invalid metronome setting %s",
  async (value) => {
    const xml = await readFile(directory + "study-3.0.musicxml", "utf8");
    await expect(
      convertMusicXml(
        bytes(
          xml.replace(
            "<per-minute>90</per-minute>",
            `<per-minute>${value}</per-minute>`,
          ),
        ),
      ),
    ).rejects.toThrow("INVALID_XML_TEMPO");
  },
);
it("keeps part timeline conflicts blocked and missing pitches partial", async () => {
  const xml = await fixture();
  const missing = await convertScore({
    bytes: bytes(
      xml.replace("<pitch><step>C</step><octave>4</octave></pitch>", ""),
    ),
    options: { mode: "PRESERVE" },
  });
  expect(missing.candidate).toHaveProperty("format", "converted-partial-v1");
  expect(missing.canGame).toBe(false);
  const extra = xml
    .match(/<part id="P1">[\s\S]*?<\/part>/)![0]
    .replace('id="P1"', 'id="P2"')
    .replace("<beats>3</beats>", "<beats>4</beats>");
  const conflict = await convertScore({
    bytes: bytes(xml.replace("</score-partwise>", extra + "</score-partwise>")),
    options: { mode: "PRESERVE" },
  });
  expect(
    conflict.issues.some(
      (index) =>
        index.code === "PART_TIMELINE_CONFLICT" &&
        index.severity === "BLOCKING",
    ),
  ).toBe(true);
  expect(conflict.canPractice).toBe(false);
});

it("preserves pickup length and the following measure position", async () => {
  const xml = await readFile(
    "src/s-core/fixtures/import/quarter.musicxml",
    "utf8",
  );
  const note = xml.match(/<note>[\s\S]*?<\/note>/)![0];
  const source = xml
    .replace('<measure number="1">', '<measure number="1" implicit="yes">')
    .replace("</part>", `<measure number="2">${note}</measure></part>`);
  const result = await convertMusicXml(bytes(source));
  expect(
    result.candidate.notes.map((n) => ("start" in n ? n.start : n.onset)),
  ).toEqual([0, 1]);
  expect(result.candidate).toHaveProperty("masterbars", [
    { id: 0, start: 0, duration: 1, end: 1 },
    { id: 1, start: 1, duration: 4, end: 5 },
  ]);
});
