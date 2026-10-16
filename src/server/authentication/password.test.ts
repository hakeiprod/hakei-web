import { afterEach, expect, it, vi } from "vitest";
import { PasswordWorkQueue, hashPassword, verifyPassword } from "./password";
afterEach(() => vi.useRealTimers());
it("hashes with Argon2id and verifies exact passwords", async () => {
  const hash = await hashPassword("  This is my password  ");
  expect(hash.startsWith("$argon2id$v=19$")).toBe(true);
  expect(hash.split("$")[3].split(",").toSorted()).toEqual([
    "m=65536",
    "p=1",
    "t=3",
  ]);
  expect(await verifyPassword(hash, "  This is my password  ")).toBe(true);
  expect(await verifyPassword(hash, "This is my password")).toBe(false);
  expect(await verifyPassword(undefined, "  This is my password  ")).toBe(
    false,
  );
});
it("holds an execution slot after timeout until native work finishes", async () => {
  vi.useFakeTimers();
  const queue = new PasswordWorkQueue({
    concurrency: 1,
    maximumQueued: 1,
    waitMs: 20,
    deadlineMs: 10,
  });
  let release!: () => void;
  const work = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = queue.run(() => work);
  const failure = expect(first).rejects.toThrow("RETRY_LATER");
  await vi.advanceTimersByTimeAsync(10);
  await failure;
  const next = vi.fn(async () => "next");
  const second = queue.run(next);
  await expect(queue.run(async () => "overflow")).rejects.toThrow(
    "RETRY_LATER",
  );
  expect(next).not.toHaveBeenCalled();
  release();
  await expect(second).resolves.toBe("next");
});
it("rejects queued jobs whose wait deadline expires", async () => {
  vi.useFakeTimers();
  const queue = new PasswordWorkQueue({
    concurrency: 1,
    maximumQueued: 1,
    waitMs: 5,
    deadlineMs: 100,
  });
  let release!: () => void;
  const first = queue.run(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const job = vi.fn(async () => "late");
  const second = queue.run(job);
  const failure = expect(second).rejects.toThrow("RETRY_LATER");
  await vi.advanceTimersByTimeAsync(5);
  await failure;
  release();
  await first;
  expect(job).not.toHaveBeenCalled();
});
it("enforces the default 2 active, 8 queued, 5 second wait and 10 second execution limits", async () => {
  vi.useFakeTimers();
  const queue = new PasswordWorkQueue();
  let release!: () => void;
  const work = new Promise<void>((resolve) => {
    release = resolve;
  });
  const jobs = Array.from({ length: 10 }, () => queue.run(() => work));
  const results = Promise.allSettled(jobs);
  await expect(queue.run(async () => true)).rejects.toThrow("RETRY_LATER");
  await vi.advanceTimersByTimeAsync(5000);
  await vi.advanceTimersByTimeAsync(5000);
  const settled = await results;
  expect(settled.filter((result) => result.status === "rejected")).toHaveLength(
    10,
  );
  // Native work can outlive the response deadline and must keep its execution slots.
  const next = vi.fn(async () => true);
  const queued = queue.run(next);
  expect(next).not.toHaveBeenCalled();
  release();
  await expect(queued).resolves.toBe(true);
});
