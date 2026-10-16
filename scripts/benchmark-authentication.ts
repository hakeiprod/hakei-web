import { performance } from "node:perf_hooks";
import { z } from "zod";
import {
  hashPassword,
  verifyPassword,
  PasswordWorkQueue,
} from "../src/server/authentication/password";
const password = "benchmark-only-password";
const warm = await hashPassword(password);
if (!(await verifyPassword(warm, password)))
  throw new Error("native verification failed");
let peakRss = process.memoryUsage().rss;
const sample = setInterval(() => {
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}, 10);
const hashTimes: number[] = [],
  verifyTimes: number[] = [];
function summary(values: number[]) {
  const ordered = values.toSorted((a, b) => a - b);
  return {
    samples: values.length,
    medianMs: ordered[Math.floor(ordered.length * 0.5)],
    p95Ms: ordered[Math.floor(ordered.length * 0.95)],
    maxMs: ordered.at(-1),
  };
}
try {
  for (let index = 0; index < 30; index++) {
    let start = performance.now();
    const hash = await hashPassword(password);
    hashTimes.push(performance.now() - start);
    start = performance.now();
    if (!(await verifyPassword(hash, password)))
      throw new Error("native verification failed");
    verifyTimes.push(performance.now() - start);
  }
  const queue = new PasswordWorkQueue();
  let active = 0,
    maximumActive = 0;
  const results = await Promise.allSettled(
    Array.from({ length: 12 }, () =>
      queue.run(async () => {
        active++;
        maximumActive = Math.max(maximumActive, active);
        try {
          return await hashPassword(password);
        } finally {
          active--;
        }
      }),
    ),
  );
  const accepted = results.filter(
    (result) => result.status === "fulfilled",
  ).length;
  const rejected = results.filter(
    (result) => result.status === "rejected",
  ).length;
  if (maximumActive !== 2 || accepted !== 10 || rejected !== 2)
    throw new Error("queue admission check failed");
  const report = z
    .object({
      header: z.object({ glibcVersionRuntime: z.string().optional() }),
    })
    .parse(process.report.getReport());
  console.log(
    JSON.stringify(
      {
        node: process.version,
        platform: process.platform,
        libc: report.header.glibcVersionRuntime ?? "musl",
        hash: summary(hashTimes),
        verify: summary(verifyTimes),
        peakRssMiB: peakRss / 1024 / 1024,
        load: { maximumActive, accepted, rejected, excessAccepted: 0 },
      },
      null,
      2,
    ),
  );
} finally {
  clearInterval(sample);
}
