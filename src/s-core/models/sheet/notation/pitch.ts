import type { NotatedPitch } from "./schema";
export const diatonicSteps = ["C", "D", "E", "F", "G", "A", "B"] as const;
export function diatonicPosition(pitch: Pick<NotatedPitch, "step" | "octave">) {
  return pitch.octave * 7 + diatonicSteps.indexOf(pitch.step);
}
