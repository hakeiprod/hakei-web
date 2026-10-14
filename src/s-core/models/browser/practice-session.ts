import type { PerformanceEvent, PracticeTimeline } from "../practice";
import { MidiRecorder } from "./midi-recorder";
import { PracticeClock, type PracticeOrigin } from "./practice-clock";
export type PracticeState =
  | "CREATED"
  | "COUNTING"
  | "RECORDING"
  | "COMPLETED"
  | "INTERRUPTED";
export interface RecordingSnapshot {
  status: "COMPLETED" | "INTERRUPTED";
  events: PerformanceEvent[];
  openNotes: number[];
  endedUs: number;
  reason?: string;
}
interface Dependencies {
  recorder: MidiRecorder;
  clock: PracticeClock;
  play: (timeline: PracticeTimeline, origin: PracticeOrigin) => void;
  stopAudio: () => void;
  audio?: EventTarget & { state: string };
  document?: Document;
  now?: () => number;
  onChange?: () => void;
  onProgress?: (elapsedUs: number) => void;
  onFinish?: (snapshot: RecordingSnapshot) => void;
}
export class PracticeSession {
  state: PracticeState = "CREATED";
  snapshot: RecordingSnapshot | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private disposed = false;
  private generation = 0;
  constructor(private readonly dependencies: Dependencies) {}
  private now() {
    return this.dependencies.now?.() ?? performance.now();
  }
  private active() {
    return this.state === "COUNTING" || this.state === "RECORDING";
  }
  private changed() {
    if (!this.disposed) this.dependencies.onChange?.();
  }
  private visibility = () => {
    if (this.dependencies.document?.visibilityState === "hidden")
      this.interrupt("HIDDEN");
  };
  private audioState = () => {
    if (this.dependencies.audio?.state !== "running")
      this.interrupt("AUDIO_INTERRUPTED");
  };
  async start(timeline: PracticeTimeline, windowUs: number, countInMs: number) {
    if (this.disposed || this.state !== "CREATED")
      throw new Error("SESSION_NOT_READY");
    if (timeline.notes.length === 0) throw new Error("EMPTY_RANGE");
    const generation = ++this.generation;
    const origin = await this.dependencies.clock.begin(countInMs);
    if (this.disposed || generation !== this.generation)
      throw new Error("SESSION_DISPOSED");
    this.dependencies.recorder.start(origin.performanceTime);
    this.state = countInMs > 0 ? "COUNTING" : "RECORDING";
    this.dependencies.document?.addEventListener(
      "visibilitychange",
      this.visibility,
    );
    this.dependencies.audio?.addEventListener("statechange", this.audioState);
    try {
      this.dependencies.play(timeline, origin);
    } catch (error) {
      this.interrupt("AUDIO_FAILED");
      throw error;
    }
    this.timer = setInterval(() => {
      if (!this.active()) return;
      const elapsed = this.dependencies.clock.relativeUs(this.now());
      if (elapsed >= 0 && this.state === "COUNTING") {
        this.state = "RECORDING";
        this.changed();
      }
      this.dependencies.onProgress?.(elapsed);
      if (elapsed >= timeline.durationUs + windowUs) this.finish("COMPLETED");
    }, 16);
    this.changed();
    return origin;
  }
  private cleanup() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.dependencies.document?.removeEventListener(
      "visibilitychange",
      this.visibility,
    );
    this.dependencies.audio?.removeEventListener(
      "statechange",
      this.audioState,
    );
    this.dependencies.stopAudio();
    this.dependencies.clock.dispose();
  }
  finish(status: "COMPLETED" | "INTERRUPTED", reason?: string) {
    if (!this.active()) return this.snapshot;
    const endedUs = Math.max(0, this.dependencies.clock.relativeUs(this.now())),
      recorded = this.dependencies.recorder.stop();
    const finalStatus =
      status === "COMPLETED" && recorded.openNotes.length > 0
        ? "INTERRUPTED"
        : status;
    this.state = finalStatus;
    this.snapshot = {
      status: finalStatus,
      events: recorded.events,
      openNotes: recorded.openNotes,
      endedUs,
      ...(reason
        ? { reason }
        : finalStatus === status
          ? {}
          : { reason: "OPEN_NOTES" }),
    };
    this.cleanup();
    this.changed();
    if (!this.disposed) this.dependencies.onFinish?.(this.snapshot);
    return this.snapshot;
  }
  interrupt(reason: string) {
    return this.finish("INTERRUPTED", reason);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    ++this.generation;
    this.interrupt("DISPOSED");
    this.cleanup();
    this.dependencies.recorder.dispose();
  }
}
