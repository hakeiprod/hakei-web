import { afterEach, describe, expect, test, vi } from "vitest";
import type { Keyboard } from "../browser/keyboard";
import { KeyeventConnecter } from "./keyevent-connecter";

const connectors: KeyeventConnecter[] = [];

function prepare() {
  const noteOn = vi.fn();
  const noteOff = vi.fn();
  const keyboard = { noteOn, noteOff } as unknown as Keyboard;
  const connector = new KeyeventConnecter(keyboard);
  connectors.push(connector);
  return { connector, noteOn, noteOff };
}

afterEach(() => {
  for (const connector of connectors) connector.dispose();
  connectors.length = 0;
});

function press(type: "keydown" | "keyup", key: string) {
  globalThis.window.dispatchEvent(new KeyboardEvent(type, { key }));
}

describe("KeyeventConnecter", () => {
  test.each([
    "ArrowLeft",
    "ArrowRight",
    "Tab",
    "Enter",
    "Escape",
    " ",
    "a",
    "1",
  ])(
    "ignores unassigned key %s on keydown and keyup without an uncaught error",
    (key) => {
      const { connector, noteOn, noteOff } = prepare();
      const error = vi.fn((event: ErrorEvent) => event.preventDefault());
      globalThis.window.addEventListener("error", error);
      try {
        expect(connector.mapTo(key)).toBeUndefined();
        press("keydown", key);
        press("keyup", key);
        expect(error).not.toHaveBeenCalled();
        expect(noteOn).not.toHaveBeenCalled();
        expect(noteOff).not.toHaveBeenCalled();
      } finally {
        globalThis.window.removeEventListener("error", error);
      }
    },
  );

  test.each([
    ["z", 55],
    ["s", 56],
    ["x", 57],
    ["d", 58],
    ["c", 59],
    ["v", 60],
    ["g", 61],
    ["b", 62],
    ["h", 63],
    ["n", 64],
    ["m", 65],
    ["k", 66],
    [",", 67],
    ["l", 68],
    [".", 69],
    [";", 70],
    ["/", 71],
    ["\\", 72],
  ] as const)(
    "plays and releases assigned key %s at MIDI pitch %i",
    (key, pitch) => {
      const { noteOn, noteOff } = prepare();
      press("keydown", key);
      press("keyup", key);
      expect(noteOn).toHaveBeenCalledTimes(1);
      expect(noteOff).toHaveBeenCalledTimes(1);
      expect(noteOn.mock.calls[0][0].pitch.value).toBe(pitch);
      expect(noteOff.mock.calls[0][0].pitch.value).toBe(pitch);
    },
  );

  test("detaches listeners before a replacement keyboard is connected", () => {
    const first = prepare();
    first.connector.dispose();
    const second = prepare();
    press("keydown", "v");
    press("keyup", "v");
    expect(first.noteOn).not.toHaveBeenCalled();
    expect(first.noteOff).not.toHaveBeenCalled();
    expect(second.noteOn).toHaveBeenCalledTimes(1);
    expect(second.noteOff).toHaveBeenCalledTimes(1);
  });
});
