import { expect, it } from "vitest";
import { detectFormat } from "./detect-format";
const bytes = (text: string) => new TextEncoder().encode(text);
it("accepts content with compatible extensions and generic upload MIME", () => {
  expect(
    detectFormat(
      bytes(
        '<?xml version="1.0"?><score-partwise version="4.0"></score-partwise>',
      ),
      "score.musicxml",
      "application/octet-stream",
    ),
  ).toBe("MUSICXML");
  expect(detectFormat(bytes("MThd12345678"), "score.mid", "audio/midi")).toBe(
    "MIDI",
  );
  expect(
    detectFormat(bytes('{"tracks":[]}'), "score.json", "application/json"),
  ).toBe("JSON");
  expect(detectFormat(new Uint8Array([80, 75, 3, 4, 0]), "score.mxl", "")).toBe(
    "MXL",
  );
});
it("rejects mismatched hints, arbitrary binary, PDF and missing accepted extensions", () => {
  expect(() =>
    detectFormat(bytes("MThd12345678"), "score.json", "application/json"),
  ).toThrow("FORMAT_MISMATCH");
  expect(() =>
    detectFormat(bytes("%PDF-1.7"), "score.pdf", "application/pdf"),
  ).toThrow("UNSUPPORTED_FORMAT");
  expect(() =>
    detectFormat(bytes('{"tracks":[]}'), "score.json", "text/html"),
  ).toThrow("FORMAT_MISMATCH");
  expect(() =>
    detectFormat(bytes("random"), "score.mid", "audio/midi"),
  ).toThrow("INVALID_FORMAT");
});
it("recognizes UTF-8 BOM without mutating the upload", () => {
  const input = new Uint8Array([239, 187, 191, ...bytes("{}")]);
  expect(detectFormat(input, "score.JSON", "")).toBe("JSON");
  expect(input[0]).toBe(239);
});
