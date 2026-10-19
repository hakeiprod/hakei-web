"use client";
import { CardBody, Card } from "@heroui/react";
import type { GameEvaluation } from "@/s-core/models/practice/game-evaluation";
export function GameResult(properties: {
  game: GameEvaluation;
  provisional: boolean;
  interrupted?: boolean;
}) {
  const game = properties.game,
    labels = {
      PERFECT: "最高判定",
      GOOD: "通常成功",
      FAIL: "失敗",
      UNASSESSED: "未評価",
    };
  return (
    <Card
      aria-label="ゲーム判定"
      as="section"
      className="min-w-0 overflow-visible border border-divider bg-content1"
    >
      <CardBody className="min-w-0 space-y-4 p-4 sm:p-6">
        <h2 className="text-xl font-semibold">
          {properties.provisional ? "暫定のゲーム判定" : "確定したゲーム結果"}
        </h2>
        <p>
          {properties.interrupted
            ? "中断のため正式スコアはありません。"
            : `得点: ${game.score === null ? "評価不可" : game.score.toFixed(2)}`}
        </p>
        <p>
          最高判定 {game.perfectCount}・通常成功 {game.goodCount}・失敗{" "}
          {game.failedCount}・余分な打鍵 {game.extraCount}
        </p>
        <p>
          コンボ: {game.finalCombo}・最大コンボ: {game.maxCombo}
        </p>
        <details className="rounded-large border border-divider p-4">
          <summary className="cursor-pointer font-medium outline-offset-4">
            単音・和音ごとの判定
          </summary>
          <ul>
            {game.units.map((unit) => (
              <li key={unit.id}>
                {(unit.onsetUs / 1_000_000).toFixed(3)}秒:{" "}
                {labels[unit.judgment]}・{unit.noteIds.length}音・コンボ
                {unit.combo}
              </li>
            ))}
          </ul>
        </details>
      </CardBody>
    </Card>
  );
}
