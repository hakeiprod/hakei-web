import { expect, test } from "vitest";
import { convertScore } from "../import/convert";
import { prepareFixture } from "../fixtures/prepare";
import { documentRecords } from "../fixtures/evaluate";
import type { FixtureDefinition } from "../fixtures/manifest";
const xml = `<score-partwise version="4.0"><part-list><score-part id="P"><part-name>TAB</part-name></score-part></part-list><part id="P"><measure number="1"><attributes><divisions>1</divisions><clef><sign>TAB</sign><line>5</line></clef><staff-details><staff-lines>6</staff-lines></staff-details></attributes><note><pitch><step>E</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type><stem>up</stem><notations><technical><string>1</string><fret>12</fret></technical></notations></note></measure></part></score-partwise>`;
test("draws an actual two-digit run, with no notehead and no staff line through it", async () => {
  const result = await convertScore({
    bytes: new TextEncoder().encode(xml),
    options: { mode: "PRESERVE" },
  });
  const f = {
    layout: {
      type: "Horizontal",
      scale: 1,
      viewportWidth: 900,
      viewportHeight: 500,
    },
  } as FixtureDefinition;
  const { controller, document } = prepareFixture(result.candidate, f);
  try {
    const records = documentRecords(document);
    const tab = records.find((r) => r.role === "tab-fret");
    expect(tab).toBeDefined();
    expect(
      records.filter((r) => r.glyphName?.startsWith("notehead")),
    ).toHaveLength(0);
    expect(records.filter((r) => r.role === "tab-digit")).toHaveLength(2);
    expect(
      records.filter((r) => r.role === "staff-line").length,
    ).toBeGreaterThan(6);
  } finally {
    controller.unmount();
  }
});
