import type { PerformanceEvent } from "../practice";
export interface MidiInputLike extends EventTarget {
  id: string;
  name: string | null;
  state: string;
  connection: string;
  open: () => Promise<unknown>;
  close: () => Promise<unknown>;
}
export interface MidiAccessLike extends EventTarget {
  inputs: ReadonlyMap<string, MidiInputLike>;
}
type Status =
  | "UNAVAILABLE"
  | "PERMISSION_REQUIRED"
  | "CONNECTED"
  | "DISCONNECTED";
interface Dependencies {
  request?: () => Promise<MidiAccessLike>;
  onChange?: () => void;
  onInterrupt?: (reason: string) => void;
}
export class MidiRecorder {
  status: Status;
  devices: { id: string; name: string }[] = [];
  selectedId: string | null = null;
  events: PerformanceEvent[] = [];
  private access: MidiAccessLike | null = null;
  private input: MidiInputLike | null = null;
  private disposed = false;
  private recording = false;
  private listening = false;
  private accessListening = false;
  private connectionGeneration = 0;
  private closing: Promise<unknown> = Promise.resolve();
  private selection = 0;
  private origin = 0;
  private sequence = 0;
  private lastTime = -1;
  private openNotes = new Map<string, number[]>();
  private readonly request: () => Promise<MidiAccessLike>;
  constructor(private readonly dependencies: Dependencies = {}) {
    const available =
      !!dependencies.request ||
      (typeof navigator !== "undefined" &&
        typeof navigator.requestMIDIAccess === "function");
    this.status = available ? "PERMISSION_REQUIRED" : "UNAVAILABLE";
    this.request =
      dependencies.request ??
      (() => navigator.requestMIDIAccess({ sysex: false }));
  }
  private changed() {
    if (!this.disposed) this.dependencies.onChange?.();
  }
  private refresh() {
    this.devices = [...(this.access?.inputs.values() ?? [])]
      .filter((input) => input.state === "connected")
      .map((input) => ({
        id: input.id,
        name: input.name ?? "名称不明のMIDI入力",
      }));
    this.changed();
  }
  private watch() {
    if (this.access && !this.accessListening) {
      this.access.addEventListener("statechange", this.stateChange);
      this.accessListening = true;
    }
  }
  private stateChange = (event: Event) => {
    const port = (event as Event & { port?: MidiInputLike }).port;
    this.refresh();
    if (port?.id === this.selectedId && port.state === "disconnected") {
      this.status = "DISCONNECTED";
      if (this.recording) this.dependencies.onInterrupt?.("DISCONNECTED");
      this.stop();
      this.changed();
    }
  };
  async connect() {
    if (this.disposed || this.status === "UNAVAILABLE") return;
    const generation = ++this.connectionGeneration;
    try {
      const access = this.access ?? (await this.request());
      if (this.disposed || generation !== this.connectionGeneration) return;
      this.access = access;
      this.watch();
      this.status = [...access.inputs.values()].some(
        (input) => input.state === "connected",
      )
        ? "CONNECTED"
        : "DISCONNECTED";
      this.refresh();
    } catch {
      if (!this.disposed) {
        this.status = "PERMISSION_REQUIRED";
        this.changed();
      }
    }
  }
  async select(id: string) {
    if (this.disposed) throw new Error("RECORDER_DISPOSED");
    const generation = ++this.selection;
    if (this.recording) {
      this.dependencies.onInterrupt?.("DEVICE_CHANGED");
      this.stop();
    }
    await this.closing;
    this.unlisten();
    const old = this.input;
    if (old) await old.close().catch(() => {});
    const input = this.access?.inputs.get(id);
    if (!input || input.state !== "connected") {
      this.status = "DISCONNECTED";
      this.changed();
      throw new Error("DISCONNECTED");
    }
    await input.open();
    if (this.disposed || generation !== this.selection) {
      await input.close().catch(() => {});
      return;
    }
    this.input = input;
    this.selectedId = id;
    input.addEventListener("midimessage", this.message);
    this.listening = true;
    this.watch();
    this.status = "CONNECTED";
    this.changed();
  }
  start(originPerformanceMs: number) {
    if (this.recording) throw new Error("ALREADY_RECORDING");
    if (
      this.disposed ||
      !this.input ||
      !this.listening ||
      this.input.state !== "connected"
    )
      throw new Error("MIDI_NOT_READY");
    if (!Number.isFinite(originPerformanceMs)) throw new Error("INVALID_CLOCK");
    this.origin = originPerformanceMs;
    this.events = [];
    this.openNotes.clear();
    this.sequence = 0;
    this.lastTime = -1;
    this.recording = true;
  }
  private message = (raw: Event) => {
    if (!this.recording || this.disposed) return;
    const message = raw as Event & { data?: Uint8Array };
    const bytes = message.data;
    if (!bytes || bytes.length !== 3 || bytes[1] > 127 || bytes[2] > 127)
      return;
    const type = bytes[0] >> 4;
    if (type !== 8 && type !== 9) return;
    const relativeUs = Math.round((message.timeStamp - this.origin) * 1000);
    if (
      !Number.isSafeInteger(relativeUs) ||
      relativeUs < 0 ||
      relativeUs > 1_801_200_000
    )
      return;
    if (relativeUs < this.lastTime) {
      this.dependencies.onInterrupt?.("INVALID_TIME");
      this.stop();
      return;
    }
    this.lastTime = relativeUs;
    const event: PerformanceEvent = {
      sequence: this.sequence++,
      type: type === 8 || bytes[2] === 0 ? "NOTE_OFF" : "NOTE_ON",
      channel: bytes[0] & 15,
      pitch: bytes[1],
      velocity: bytes[2],
      relativeUs,
    };
    const key = `${event.channel}:${event.pitch}`,
      queue = this.openNotes.get(key) ?? [];
    if (event.type === "NOTE_ON") queue.push(event.sequence);
    else queue.shift();
    this.openNotes.set(key, queue);
    if (this.events.length >= 100_000) {
      this.dependencies.onInterrupt?.("EVENT_LIMIT");
      this.stop();
      return;
    }
    this.events.push(event);
    this.changed();
  };
  private unlisten() {
    if (this.input && this.listening)
      this.input.removeEventListener("midimessage", this.message);
    this.listening = false;
    if (this.access && this.accessListening)
      this.access.removeEventListener("statechange", this.stateChange);
    this.accessListening = false;
  }
  stop() {
    this.recording = false;
    const close = this.listening && this.input;
    this.unlisten();
    if (close) this.closing = close.close().catch(() => {});
    return {
      events: this.events.map((event) => ({ ...event })),
      openNotes: [...this.openNotes.values()].flat().toSorted((a, b) => a - b),
    };
  }
  dispose() {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    ++this.selection;
    ++this.connectionGeneration;
    this.access = null;
    this.input = null;
    this.devices = [];
  }
}
