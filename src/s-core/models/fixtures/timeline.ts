import { Timeline } from "../practice/timeline";
import { Conditions } from "../practice/conditions";
import type { SheetScoreJson } from "../import/score-schema";
export function fixtureTimeline(score: SheetScoreJson) {
  return Timeline.create(
    score,
    Conditions.import({
      trackId: score.tracks[0].id,
      rangeStartBar: 1,
      rangeEndBar: score.masterbars.length,
      tempoScale: 1,
      calibrationUs: 0,
      mode: "PRACTICE",
      ruleVersion: 1,
    }),
  ).export();
}
