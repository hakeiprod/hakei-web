import { sheetScoreSchema, type SheetScoreJson } from "../import/score-schema";
import { yieldToTask } from "./render-scheduler";
export type ValidationReply =
  { ok: true; data: SheetScoreJson } | { ok: false };

// Bound the entire captured value, including unknown fields, before allowing
// the unchanged schema on the main thread. Large scores still use a worker.
export function hasBoundedValidationSize(input: unknown): boolean {
  const pending = [input];
  let remaining = 512;
  while (pending.length > 0) {
    if (--remaining < 0) return false;
    const value = pending.pop();
    if (typeof value === "string" && value.length > 256) return false;
    if (value === null || typeof value !== "object") continue;
    if (
      Object.getPrototypeOf(value) !== Object.prototype &&
      !Array.isArray(value)
    )
      return false;
    if (Array.isArray(value) && (value.length > 32 || value.length > remaining))
      return false;
    for (const key in value) {
      if (!Object.hasOwn(value, key)) continue;
      if (key.length > 256 || pending.length >= remaining) return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor)) return false;
      pending.push(descriptor.value);
    }
  }
  return true;
}

/** Eligible values stay private; larger inputs must take the async worker path. */
export function tryValidateSmallSheetScore(
  input: unknown,
): SheetScoreJson | undefined {
  if (!hasBoundedValidationSize(input)) return undefined;
  // Compiling validators costs more than interpreting this bounded input once.
  // Keep the complete schema and its refinements; only skip code generation.
  return sheetScoreSchema.parse(structuredClone(input), { jitless: true });
}

/** Run the unchanged schema without a long main-thread validation task. */
export async function validateSheetScore(
  input: unknown,
  signal?: AbortSignal,
): Promise<SheetScoreJson> {
  if (signal?.aborted)
    throw new DOMException("Validation aborted", "AbortError");
  const small = hasBoundedValidationSize(input);
  if (typeof Worker === "undefined" || small) {
    const captured = structuredClone(input);
    if (typeof Worker === "undefined") await yieldToTask(signal);
    else {
      // This bounded parse is shorter than a render slice. Let an immediately
      // issued abort win without delaying tiny scores to another browser task.
      // Long validation stays in the worker; rendering still yields real tasks.
      await Promise.resolve();
      if (signal?.aborted)
        throw new DOMException("Validation aborted", "AbortError");
    }
    return sheetScoreSchema.parse(captured, { jitless: small });
  }
  return new Promise<SheetScoreJson>((resolve, reject) => {
    let worker: Worker | undefined,
      finished = false;
    const finish = (data?: SheetScoreJson, error?: unknown) => {
      if (finished) return;
      finished = true;
      signal?.removeEventListener("abort", abort);
      if (worker) {
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
        worker.removeEventListener("messageerror", onMessageError);
        worker.terminate();
      }
      if (data === undefined) reject(error);
      else resolve(data);
    };
    const abort = () =>
      finish(undefined, new DOMException("Validation aborted", "AbortError"));
    const onMessage = (event: MessageEvent<ValidationReply>) => {
      if (signal?.aborted) {
        abort();
        return;
      }
      if (event.data.ok) finish(event.data.data);
      else finish(undefined, new Error("Invalid score data"));
    };
    const onError = (event: ErrorEvent) => {
      event.preventDefault();
      finish(undefined, new Error("Score validation worker failed"));
    };
    const onMessageError = () =>
      finish(undefined, new Error("Invalid validation response"));
    try {
      worker = new Worker(
        new URL("validate-sheet-score.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      worker.addEventListener("messageerror", onMessageError);
      signal?.addEventListener("abort", abort, { once: true });
      // postMessage captures caller values synchronously, before suspension.
      worker.postMessage(input);
    } catch (error) {
      finish(undefined, error);
    }
  });
}
