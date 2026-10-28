export type RenderTaskPriority = "background" | "user-visible";
interface DrainOptions {
  signal?: AbortSignal;
  budgetMs?: number;
  now?: () => number;
  yieldTask?: () => Promise<void>;
  priority?: RenderTaskPriority;
}

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new DOMException("Rendering aborted", "AbortError");
}

/** Leave a paint opportunity before preparing secondary UI resources. */
export function yieldToPaint(signal?: AbortSignal): Promise<void> {
  checkAbort(signal);
  if (typeof requestAnimationFrame !== "function") return yieldToTask(signal);
  return new Promise<void>((resolve, reject) => {
    let frame: number | undefined;
    const cleanup = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Preparation aborted", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        frame = undefined;
        cleanup();
        resolve();
      });
    });
  });
}

/** A real task boundary, with an abortable timer fallback (never a microtask). */
export function yieldToTask(
  signal?: AbortSignal,
  task?: () => Promise<void>,
  priority: RenderTaskPriority = "user-visible",
) {
  checkAbort(signal);
  const scheduler = (
    globalThis as typeof globalThis & {
      scheduler?: {
        yield?: () => Promise<void>;
        postTask?: (
          callback: () => void,
          options: { priority: RenderTaskPriority; signal?: AbortSignal },
        ) => Promise<void>;
      };
    }
  ).scheduler;
  const run =
    task ??
    // Only size-bounded work may use boosted continuations. Large scores
    // resume in fresh background tasks so ordinary UI updates can run.
    (priority === "user-visible" && typeof scheduler?.yield === "function"
      ? () => scheduler.yield!()
      : typeof scheduler?.postTask === "function"
        ? () => scheduler.postTask!(() => {}, { priority, signal })
        : typeof scheduler?.yield === "function"
          ? () => scheduler.yield!()
          : undefined);
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Rendering aborted", "AbortError"));
    };
    const finish = () => {
      cleanup();
      resolve();
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    if (run) {
      try {
        run().then(finish, (error) => {
          cleanup();
          reject(error);
        });
      } catch (error) {
        cleanup();
        reject(error);
      }
    } else timer = setTimeout(finish, 0);
  });
}

export async function drainCooperatively<Result>(
  steps: Iterator<unknown, Result, void>,
  {
    signal,
    budgetMs = 8,
    now = () => performance.now(),
    yieldTask,
    priority = "background",
  }: DrainOptions = {},
): Promise<Result> {
  let complete = false;
  try {
    if (!Number.isFinite(budgetMs) || budgetMs <= 0)
      throw new Error("Invalid rendering budget");
    checkAbort(signal);
    let started = now();
    while (true) {
      checkAbort(signal);
      const step = steps.next();
      checkAbort(signal);
      if (step.done) {
        complete = true;
        return step.value;
      }
      if (now() - started >= budgetMs) {
        checkAbort(signal);
        await yieldToTask(signal, yieldTask, priority);
        checkAbort(signal);
        started = now();
      }
    }
  } finally {
    if (!complete) steps.return?.();
  }
}
