import "server-only";
import { z } from "zod";
function configured(name: string, fallback: number, maximum: number) {
  return z.coerce
    .number()
    .int()
    .positive()
    .max(maximum)
    .parse(process.env[name] ?? fallback);
}
export function importLimits() {
  return {
    maxInputBytes: configured(
      "IMPORT_MAX_INPUT_BYTES",
      5 * 1024 * 1024,
      5 * 1024 * 1024,
    ),
    timeoutMs: configured("IMPORT_TIMEOUT_MS", 10_000, 10_000),
    workerHeapMb: 128,
    maxConcurrentWorkers: configured("IMPORT_MAX_CONCURRENT_WORKERS", 4, 16),
  };
}
