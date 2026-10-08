import { afterEach, expect, test, vi } from "vitest";
import type { Keyboard } from "../browser/keyboard";
import { KeyeventConnecter } from "./keyevent-connecter";
import { MidiinputConnecter } from "./midiinput-connecter";

afterEach(() => vi.unstubAllGlobals());
const keyboard = () =>
  ({ noteOn: vi.fn(), noteOff: vi.fn() }) as unknown as Keyboard;

test("disposing keyboard input removes only its own subscriptions", () => {
  const keys = keyboard();
  const external = vi.fn();
  globalThis.addEventListener("keydown", external);
  const connecter = new KeyeventConnecter(keys);
  globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "z" }));
  expect(keys.noteOn).toHaveBeenCalledOnce();
  globalThis.dispatchEvent(new KeyboardEvent("keyup", { key: "z" }));
  expect(keys.noteOff).toHaveBeenCalledOnce();
  connecter.dispose();
  globalThis.dispatchEvent(new KeyboardEvent("keyup", { key: "z" }));
  expect(keys.noteOff).toHaveBeenCalledOnce();
  globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "z" }));
  expect(keys.noteOn).toHaveBeenCalledOnce();
  expect(external).toHaveBeenCalledTimes(2);
  globalThis.removeEventListener("keydown", external);
});

test("MIDI permission resolving after disposal does not attach a listener", async () => {
  let resolve!: (value: MIDIAccess) => void;
  const permission = new Promise<MIDIAccess>((done) => {
    resolve = done;
  });
  vi.stubGlobal("navigator", { requestMIDIAccess: () => permission });
  const addEventListener = vi.fn();
  const connecter = new MidiinputConnecter(keyboard());
  connecter.dispose();
  resolve({
    inputs: new Map([["input", { addEventListener }]]),
  } as unknown as MIDIAccess);
  await permission;
  expect(addEventListener).not.toHaveBeenCalled();
});

const message = () =>
  Object.assign(new Event("midimessage"), {
    data: new Uint8Array([0x90, 60, 100]),
  });

test("disposing MIDI input removes message handling", async () => {
  const input = new EventTarget();
  const permission = Promise.resolve({
    inputs: new Map([["input", input]]),
  } as unknown as MIDIAccess);
  vi.stubGlobal("navigator", { requestMIDIAccess: () => permission });
  const keys = keyboard();
  const connecter = new MidiinputConnecter(keys);
  await permission;
  input.dispatchEvent(message());
  expect(keys.noteOn).toHaveBeenCalledOnce();
  connecter.dispose();
  input.dispatchEvent(message());
  expect(keys.noteOn).toHaveBeenCalledOnce();
});
