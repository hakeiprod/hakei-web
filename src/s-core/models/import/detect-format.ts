export type DetectedFormat = "MUSICXML" | "MXL" | "MIDI" | "JSON";
const accepted = {
  MUSICXML: {
    extensions: ["xml", "musicxml"],
    mimes: [
      "application/xml",
      "text/xml",
      "application/vnd.recordare.musicxml+xml",
    ],
  },
  MXL: {
    extensions: ["mxl"],
    mimes: [
      "application/zip",
      "application/x-zip-compressed",
      "application/vnd.recordare.musicxml",
    ],
  },
  MIDI: {
    extensions: ["mid", "midi"],
    mimes: ["audio/midi", "audio/mid", "audio/x-midi", "application/x-midi"],
  },
  JSON: { extensions: ["json"], mimes: ["application/json", "text/json"] },
} as const;
/** Magic bytes identify the container; parsers subsequently validate its full structure/version. */
export function detectFormat(
  bytes: Uint8Array,
  sourceName: string | undefined,
  mime = "",
): DetectedFormat {
  const extension = sourceName?.toLowerCase().split(".").at(-1) ?? "";
  if (
    sourceName !== undefined &&
    !Object.values(accepted).some((entry) =>
      (entry.extensions as readonly string[]).includes(extension),
    )
  )
    throw new Error("UNSUPPORTED_FORMAT");
  if (bytes.length === 0) throw new Error("INVALID_FORMAT");
  const prefix = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.subarray(0, Math.min(bytes.length, 4096)))
    .trimStart();
  let format: DetectedFormat;
  if (
    bytes[0] === 77 &&
    bytes[1] === 84 &&
    bytes[2] === 104 &&
    bytes[3] === 100
  )
    format = "MIDI";
  else if (
    bytes[0] === 80 &&
    bytes[1] === 75 &&
    bytes[2] === 3 &&
    bytes[3] === 4
  )
    format = "MXL";
  else if (prefix.startsWith("<")) format = "MUSICXML";
  else if (prefix.startsWith("{")) format = "JSON";
  else throw new Error("INVALID_FORMAT");
  const hints = accepted[format];
  const normalizedMime = mime.split(";", 1)[0].trim().toLowerCase();
  if (
    (sourceName !== undefined &&
      !(hints.extensions as readonly string[]).includes(extension)) ||
    (normalizedMime &&
      normalizedMime !== "application/octet-stream" &&
      !(hints.mimes as readonly string[]).includes(normalizedMime))
  )
    throw new Error("FORMAT_MISMATCH");
  return format;
}
