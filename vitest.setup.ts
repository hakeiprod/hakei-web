import "./src/s-core/extensions/buffer/to-array-buffer.extensions";
import "./src/s-core/models/core/extensions/to-sheet";
import "./src/s-core/models/files/musicxml/extensions/to-sheet";

// jsdom lacks CSS.escape; React Aria uses it to focus collection items.
// Hex-escaping each code point produces a valid identifier for fixture keys.
Object.defineProperty(globalThis, "CSS", {
  configurable: true,
  value: {
    escape: (value: string) =>
      Array.from(
        String(value),
        (character) => `\\${character.codePointAt(0)!.toString(16)} `,
      ).join(""),
  },
});
