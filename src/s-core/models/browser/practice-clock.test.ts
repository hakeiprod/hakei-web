import { expect, it, vi } from "vitest";
import { PracticeClock } from "./practice-clock";
it("waits for resume and maps the output clock origin before capture", async () => {
  let finish!: () => void;
  const context = {
    state: "suspended",
    currentTime: 1,
    resume: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = () => {
            context.state = "running";
            resolve();
          };
        }),
    ),
    getOutputTimestamp: () => ({ contextTime: 0.95, performanceTime: 1000 }),
  };
  const clock = new PracticeClock(context, () => 1050);
  const pending = clock.begin(0);
  expect(clock.origin).toBeNull();
  finish();
  const origin = await pending;
  expect(origin.performanceTime).toBe(1050);
  expect(clock.relativeUs(1100)).toBe(50_000);
});
it("uses the documented fallback sample and refuses a disposed delayed resume", async () => {
  const context = {
    state: "running",
    currentTime: 2,
    resume: vi.fn(async () => {}),
    getOutputTimestamp: () => ({ contextTime: 0, performanceTime: 0 }),
  };
  const clock = new PracticeClock(context, () => 2000);
  const origin = await clock.begin(0);
  expect(origin.kind).toBe("FALLBACK");
  expect(clock.relativeUs(2010)).toBe(10_000);
  clock.dispose();
  await expect(clock.begin(0)).rejects.toThrow("CLOCK_DISPOSED");
});
