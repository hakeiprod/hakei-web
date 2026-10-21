import { z } from "zod";
import { detectFormat } from "./detect-format";
import { validateCandidate } from "./diagnostics";
import { importMetadataSchema } from "./contracts";
import { convertJson } from "./json";
import { convertMidi } from "./midi";
import { convertMusicXml } from "./musicxml";
import { extractMxl } from "./mxl";
import {
  midiConversionOptionsSchema,
  type MidiConversionOptions,
} from "./quantize-midi";
export const converterVersion = "score-import-v4";
export interface ConversionInput {
  bytes: Uint8Array;
  sourceName?: string;
  formatHint?: "MUSICXML" | "MIDI" | "CORE_JSON" | "SHEET_JSON";
  mime?: string;
  options: MidiConversionOptions;
}
/** The caller retains its own original bytes; every conversion uses an independent copy. */
export async function convertScore(input: ConversionInput) {
  if (input.bytes.byteLength > 5 * 1024 * 1024) throw new Error("INPUT_LIMIT");
  const options = midiConversionOptionsSchema.parse(input.options);
  const bytes = new Uint8Array(input.bytes);
  const detected = detectFormat(bytes, input.sourceName, input.mime);
  if (detected !== "MIDI" && options.mode !== "PRESERVE")
    throw new Error("INVALID_CONVERSION_OPTIONS");
  let result;
  let format: "MUSICXML" | "MIDI" | "CORE_JSON" | "SHEET_JSON";
  let formatVersion: string;
  if (detected === "MIDI") {
    result = convertMidi(bytes, options);
    format = "MIDI";
    formatVersion = "SMF-1.0";
  } else if (detected === "MUSICXML" || detected === "MXL") {
    result = await convertMusicXml(
      detected === "MXL" ? await extractMxl(bytes) : bytes,
    );
    format = "MUSICXML";
    formatVersion = result.formatVersion;
  } else {
    const json = z
      .json()
      .parse(
        JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
      );
    result = convertJson(json);
    format = result.format;
    formatVersion = "1";
  }
  if (input.formatHint !== undefined && input.formatHint !== format)
    throw new Error("FORMAT_MISMATCH");
  const metadata = importMetadataSchema.parse({
    format,
    formatVersion,
    converterVersion,
    options,
    ...(input.sourceName === undefined
      ? {}
      : { sourceName: input.sourceName.split(/[\\/]/).at(-1) }),
  });
  const validated = validateCandidate(result.candidate, result.issues);
  return {
    ...validated,
    metadata,
    canPractice: validated.validation.canPractice,
    canGame: validated.validation.canGame,
    ...("changedNoteCount" in result && "changes" in result
      ? { changedNoteCount: result.changedNoteCount, changes: result.changes }
      : {}),
  };
}
