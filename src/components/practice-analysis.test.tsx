import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { PracticeAnalysis } from "./practice-analysis";
import { GameResult } from "./game-result";
afterEach(cleanup);
test("preserves provisional, unavailable and per-bar values in the accessible table", () => {
  const summary = {
    expectedCount: 2,
    correctCount: 1,
    wrongCount: 0,
    missedCount: 1,
    extraCount: 0,
    pitchAccuracy: 0.5,
    meanAbsTimingUs: 1250,
  };
  render(
    <PracticeAnalysis
      provisional
      analysis={{
        summary,
        perBar: [
          { ...summary, barNumber: 1 },
          {
            ...summary,
            barNumber: 2,
            pitchAccuracy: null,
            meanAbsTimingUs: null,
          },
        ],
        perNote: [],
      }}
    />,
  );
  expect(screen.getByRole("heading", { name: "暫定の演奏分析" })).toBeDefined();
  const table = screen.getByRole("grid", { name: "小節別の分析" });
  expect(within(table).getByText("50.0%")).toBeDefined();
  expect(within(table).getByText("1.3 ms")).toBeDefined();
  expect(within(table).getAllByText("未評価")).toHaveLength(2);
  expect(screen.getByText("音ごとの結果").tagName).toBe("SUMMARY");
});
test("preserves interrupted game explanation and score precision", () => {
  render(
    <GameResult
      interrupted
      provisional={false}
      game={{
        score: null,
        expectedCount: 0,
        perfectCount: 0,
        goodCount: 0,
        failedCount: 0,
        extraCount: 0,
        finalCombo: 0,
        maxCombo: 0,
        units: [],
      }}
    />,
  );
  expect(screen.getByText("中断のため正式スコアはありません。")).toBeDefined();
});
