import { afterEach, expect, test, vi } from "vitest";
import sheet from "../../fixtures/import/quarter-sheet.json";
import { sheetScoreSchema } from "../import/score-schema";
import {
  tryValidateSmallSheetScore,
  validateSheetScore,
} from "./validate-sheet-score";
const instances: FakeWorker[] = [];
const largeSheet = {
  ...sheet,
  notes: Array.from({ length: 256 }, (_, id) => ({ ...sheet.notes[0], id })),
};
class FakeWorker extends EventTarget {
  terminate = vi.fn();
  removeEventListener = vi.fn(
    // The spy must call the inherited method on this worker instance.
    // eslint-disable-next-line unicorn/consistent-function-scoping
    (...parameters: Parameters<EventTarget["removeEventListener"]>) =>
      super.removeEventListener(...parameters),
  );
  postMessage(input: unknown) {
    const captured = structuredClone(input);
    setTimeout(() => {
      const result = sheetScoreSchema.safeParse(captured);
      this.dispatchEvent(
        new MessageEvent("message", {
          data: result.success
            ? { ok: true, data: result.data }
            : { ok: false },
        }),
      );
    }, 0);
  }
  constructor() {
    super();
    instances.push(this);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  instances.length = 0;
});
test("bounded validation works without runtime code generation and retains schema errors", () => {
  const originalFunction = globalThis.Function;
  vi.stubGlobal("Function", () => {
    throw new Error("Runtime code generation disabled");
  });
  let actual: unknown;
  try {
    actual = tryValidateSmallSheetScore(sheet);
  } finally {
    vi.stubGlobal("Function", originalFunction);
  }
  expect(actual).toEqual(sheetScoreSchema.parse(sheet));
  for (const input of [
    { ...sheet, notes: [{ ...sheet.notes[0], pitch: "invalid" }] },
    { ...sheet, notes: [{ ...sheet.notes[0], duration: -1 }] },
    { ...sheet, tracks: [] },
    { notes: [] },
  ]) {
    const expected = sheetScoreSchema.safeParse(input);
    try {
      const value = tryValidateSmallSheetScore(input);
      expect(expected.success).toBe(true);
      if (expected.success) expect(value).toEqual(expected.data);
    } catch (error) {
      expect(expected.success).toBe(false);
      if (!expected.success)
        expect((error as { issues: unknown }).issues).toEqual(
          expected.error.issues,
        );
    }
  }
});
test("worker validation captures input and returns exactly the existing schema output", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  const input = structuredClone(largeSheet),
    expected = sheetScoreSchema.parse(input);
  const pending = validateSheetScore(input);
  input.notes[0].pitch = 72;
  expect(await pending).toEqual(expected);
  expect(instances[0].terminate).toHaveBeenCalledOnce();
  expect(instances[0].removeEventListener).toHaveBeenCalledTimes(3);
});
test("invalid input and abort terminate their private worker without late completion", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  await expect(
    validateSheetScore({ notes: Array.from({ length: 1024 }, () => ({})) }),
  ).rejects.toThrow();
  expect(instances[0].terminate).toHaveBeenCalledOnce();
  const abort = new AbortController();
  const pending = validateSheetScore(largeSheet, abort.signal);
  abort.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(instances[1].terminate).toHaveBeenCalledOnce();
  expect(instances[1].removeEventListener).toHaveBeenCalledTimes(3);
});
test("non-worker callers retain the same validated values and reject invalid input", async () => {
  // stubGlobal requires an explicit value for a runtime without Worker.
  // eslint-disable-next-line unicorn/no-useless-undefined
  vi.stubGlobal("Worker", undefined);
  expect(await validateSheetScore(sheet)).toEqual(
    sheetScoreSchema.parse(sheet),
  );
  await expect(validateSheetScore({ notes: [] })).rejects.toThrow();
});

test("small inputs use the same schema without worker startup and capture before yielding", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  const input = structuredClone(sheet);
  const expected = sheetScoreSchema.parse(input);
  const pending = validateSheetScore(input);
  input.notes[0].pitch = 72;
  expect(await pending).toEqual(expected);
  expect(instances).toHaveLength(0);
  await expect(validateSheetScore({ notes: [] })).rejects.toThrow();
  const abort = new AbortController();
  const cancelled = validateSheetScore(sheet, abort.signal);
  abort.abort();
  await expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
});

test("unknown large fields and cyclic inputs do not enter the bounded main-thread path", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  const unknown = { ...sheet, unknown: "x".repeat(257) };
  expect(await validateSheetScore(unknown)).toEqual(
    sheetScoreSchema.parse(unknown),
  );
  const cycle: Record<string, unknown> = { ...sheet };
  cycle.self = cycle;
  expect(await validateSheetScore(cycle)).toEqual(
    sheetScoreSchema.parse(cycle),
  );
  expect(instances).toHaveLength(2);
});

test("large sparse arrays cannot amplify schema diagnostics on the main thread", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  await expect(
    validateSheetScore({ notes: Array.from({ length: 64 }, () => ({})) }),
  ).rejects.toThrow();
  expect(instances).toHaveLength(1);
  expect(instances[0].terminate).toHaveBeenCalledOnce();
});
