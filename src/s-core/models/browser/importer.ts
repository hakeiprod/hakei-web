import { convertScore } from "../import/convert";
import type { MidiConversionOptions } from "../import/quantize-midi";
import { sheetScoreSchema } from "../import/score-schema";
import * as Sheet from "../sheet";
const preserve: MidiConversionOptions = { mode: "PRESERVE" };
/** Caller owns the File; this adapter never retains it or writes browser storage. */
export class Importer {
  async preview(file: File, options: MidiConversionOptions = preserve) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      return await convertScore({
        bytes,
        sourceName: file.name,
        mime: file.type,
        options,
      });
    } finally {
      bytes.fill(0);
    }
  }
  async import(file: File, options: MidiConversionOptions = preserve) {
    const result = await this.preview(file, options);
    if (
      result.issues.some(
        (issue) =>
          issue.severity === "BLOCKING" &&
          issue.status === "UNRESOLVED" &&
          issue.code !== "NO_EXPECTED_ATTACKS",
      )
    )
      throw new Error("MUSICAL_INFORMATION_INCOMPLETE");
    const data = sheetScoreSchema.parse(result.candidate);
    return Sheet.Score.import(
      data as unknown as ReturnType<Sheet.Score["export"]>,
    );
  }
}
