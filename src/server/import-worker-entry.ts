import { parentPort, workerData } from "node:worker_threads";
import { z } from "zod";
import { convertScore } from "@/s-core/models/import/convert";
import { midiConversionOptionsSchema } from "@/s-core/models/import/quantize-midi";
const request = z
  .object({
    bytes: z.instanceof(Uint8Array),
    sourceName: z.string().max(255).optional(),
    formatHint: z
      .enum(["MUSICXML", "MIDI", "CORE_JSON", "SHEET_JSON"])
      .optional(),
    mime: z.string().max(200).optional(),
    options: midiConversionOptionsSchema,
  })
  .strict()
  .parse(workerData);
try {
  const result = await convertScore(request);
  parentPort?.postMessage({ ok: true, result });
} catch (error) {
  const message = error instanceof Error ? error.message : "";
  parentPort?.postMessage({
    ok: false,
    code: /^[A-Z0-9_]{1,80}$/.test(message) ? message : "INVALID_FORMAT",
  });
} finally {
  request.bytes.fill(0);
  parentPort?.close();
}
