import { Glyph } from "../glyph";
import { ElementType } from "../../sheet";
export function fretRun(value: number, line: number) {
  const scale = 0.6;
  let x = 0;
  const digits = [...String(value)].map((d) => {
    const glyph = new Glyph(
      `timeSig${d}` as `timeSig${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`,
      ElementType.Notehead,
      line,
    );
    const width = glyph.glyphAdvanceWidth * scale;
    const at = x;
    x += width + 0.05;
    return { glyph, x: at, scale };
  });
  return {
    value,
    digits,
    width: Math.max(0, x - 0.05),
    height: Math.max(...digits.map((d) => d.glyph.height * scale)),
  };
}
/** Subtract merged ink intervals from a staff line, independent of background color. */
export function staffSegments(
  width: number,
  gaps: readonly [number, number][],
) {
  const result: [number, number][] = [];
  let x = 0;
  for (const [a, b] of gaps.toSorted((a, b) => a[0] - b[0])) {
    const left = Math.max(0, a),
      right = Math.min(width, b);
    if (left > x) result.push([x, left]);
    x = Math.max(x, right);
  }
  if (x < width) result.push([x, width]);
  return result;
}
