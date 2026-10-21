import { expect, test } from "vitest";
import { convertScore } from "./convert";
const xml = `<score-partwise version="4.0"><part-list><score-part id="P"><part-name>TAB</part-name></score-part></part-list><part id="P"><measure number="1"><attributes><divisions>1</divisions><clef><sign>TAB</sign><line>5</line></clef><staff-details><staff-lines>6</staff-lines></staff-details></attributes><note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><notations><technical><string>1</string><fret>0</fret></technical></notations></note></measure></part></score-partwise>`;
for (const version of ["2.0", "3.0", "3.1", "4.0"])
  test(`retains TAB ${version}`, async () => {
    const result = await convertScore({
      bytes: new TextEncoder().encode(
        xml.replace('version="4.0"', `version="${version}"`),
      ),
      options: { mode: "PRESERVE" },
    });
    expect(result.candidate.notes[0]).toMatchObject({
      pitch: 64,
      tablature: { string: 1, fret: 0 },
    });
    expect("format" in result.candidate).toBe(false);
  });
export { xml as tabXml };
