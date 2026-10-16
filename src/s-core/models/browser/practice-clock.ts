export interface PracticeAudioClock {
  state: string;
  currentTime: number;
  resume: () => Promise<void>;
  getOutputTimestamp?: () => { contextTime?: number; performanceTime?: number };
}
export interface PracticeOrigin {
  contextTime: number;
  performanceTime: number;
  kind: "OUTPUT_TIMESTAMP" | "FALLBACK";
}
export class PracticeClock {
  origin: PracticeOrigin | null = null;
  private disposed = false;
  constructor(
    private readonly audio: PracticeAudioClock,
    private readonly now: () => number = () => performance.now(),
  ) {}
  async begin(countInMs: number) {
    if (this.disposed) throw new Error("CLOCK_DISPOSED");
    if (!Number.isFinite(countInMs) || countInMs < 0 || countInMs > 30_000)
      throw new Error("INVALID_COUNT_IN");
    await this.audio.resume();
    if (this.disposed) throw new Error("CLOCK_DISPOSED");
    if (this.audio.state !== "running") throw new Error("AUDIO_INTERRUPTED");
    const before = this.now(),
      contextTime = this.audio.currentTime + countInMs / 1000,
      after = this.now();
    let performanceTime = (before + after) / 2 + countInMs,
      kind: PracticeOrigin["kind"] = "FALLBACK";
    try {
      const timestamp = this.audio.getOutputTimestamp?.();
      if (
        timestamp &&
        typeof timestamp.contextTime === "number" &&
        typeof timestamp.performanceTime === "number" &&
        Number.isFinite(timestamp.contextTime) &&
        timestamp.contextTime >= 0 &&
        Number.isFinite(timestamp.performanceTime) &&
        timestamp.performanceTime > 0
      ) {
        performanceTime =
          timestamp.performanceTime +
          (contextTime - timestamp.contextTime) * 1000;
        kind = "OUTPUT_TIMESTAMP";
      }
    } catch {
      /* Fallback uses the paired context/performance sample. */
    }
    if (!Number.isFinite(performanceTime) || !Number.isFinite(contextTime))
      throw new Error("INVALID_CLOCK");
    this.origin = { contextTime, performanceTime, kind };
    return this.origin;
  }
  relativeUs(timeStamp: number) {
    if (this.disposed || !this.origin) throw new Error("CLOCK_NOT_READY");
    if (!Number.isFinite(timeStamp)) throw new Error("INVALID_CLOCK");
    return Math.round((timeStamp - this.origin.performanceTime) * 1000);
  }
  dispose() {
    this.disposed = true;
    this.origin = null;
  }
}
