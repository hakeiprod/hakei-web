export const staffY = (line: number) => 5 - line;
import type { Stave } from "../../sheet/stave";
export function staffGeometry(stave: Stave) {
  const lines =
    stave.staffSettings?.lineCount ??
    stave.score.tracks.find((t) => t.id === stave.trackId)?.staffDetails[
      "staff-lines"
    ]?.[0]._ ??
    5;
  return {
    lineCount: lines,
    height: lines - 1,
    yForLine: staffY,
  };
}
