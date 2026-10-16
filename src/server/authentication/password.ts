import "server-only";
import { randomBytes } from "node:crypto";
import { passwordSchema } from "./input";

type QueueOptions = {
  concurrency: number;
  maximumQueued: number;
  waitMs: number;
  deadlineMs: number;
};
type WaitingJob = { start: () => void; timer: ReturnType<typeof setTimeout> };

export class PasswordWorkQueue {
  private active = 0;
  private readonly waiting: WaitingJob[] = [];
  constructor(
    private readonly options: QueueOptions = {
      concurrency: 2,
      maximumQueued: 8,
      waitMs: 5000,
      deadlineMs: 10_000,
    },
  ) {}

  run<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        this.active++;
        const timer = setTimeout(
          () => reject(new Error("RETRY_LATER")),
          this.options.deadlineMs,
        );
        Promise.resolve()
          .then(operation)
          .then(resolve, () => reject(new Error("RETRY_LATER")))
          .finally(() => {
            clearTimeout(timer);
            this.active--;
            const next = this.waiting.shift();
            if (next) {
              clearTimeout(next.timer);
              next.start();
            }
          });
      };
      if (this.active < this.options.concurrency) {
        start();
        return;
      }
      if (this.waiting.length >= this.options.maximumQueued) {
        reject(new Error("RETRY_LATER"));
        return;
      }
      const job: WaitingJob = {
        start,
        timer: setTimeout(() => {
          const index = this.waiting.indexOf(job);
          if (index !== -1) this.waiting.splice(index, 1);
          reject(new Error("RETRY_LATER"));
        }, this.options.waitMs),
      };
      this.waiting.push(job);
    });
  }
}

const queue = new PasswordWorkQueue();
const parameters = { memoryCost: 65_536, timeCost: 3, parallelism: 1 };
let dummyHash: Promise<string> | undefined;

export function hashPassword(value: string) {
  const password = passwordSchema.parse(value);
  return queue.run(async () => {
    const argon2 = await import("argon2");
    return argon2.hash(password, { ...parameters, type: argon2.argon2id });
  });
}

export function verifyPassword(hash: string | undefined, value: string) {
  const password = passwordSchema.parse(value);
  return queue.run(async () => {
    const argon2 = await import("argon2");
    dummyHash ??= argon2
      .hash(randomBytes(32), { ...parameters, type: argon2.argon2id })
      .catch(() => {
        dummyHash = undefined;
        throw new Error("RETRY_LATER");
      });
    const dummy = await dummyHash;
    if (!hash) {
      await argon2.verify(dummy, password);
      return false;
    }
    return argon2.verify(hash, password);
  });
}
