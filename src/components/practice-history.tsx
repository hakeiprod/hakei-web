"use client";
import { CardBody, Card, Button, Link as HeroLink } from "@heroui/react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deletePractice } from "@/app/actions/practice-history";
import type { listPractice } from "@/server/practice-history";
export type PracticeHistoryData = Awaited<ReturnType<typeof listPractice>>;
export function PracticeDelete(properties: { sessionId: string }) {
  const router = useRouter(),
    [confirmation, setConfirmation] = useState<{
      key: string;
    } | null>(null),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  async function remove() {
    if (!confirmation || pending) return;
    setPending(true);
    try {
      const result = await deletePractice({
        sessionId: properties.sessionId,
        key: confirmation.key,
      });
      if (result.ok) {
        setConfirmation(null);
        router.refresh();
      } else setMessage(result.error.message);
    } catch {
      setMessage("削除できませんでした。再試行してください。");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      {confirmation ? (
        <>
          <p>
            この演奏の入力と結果を削除し、残る記録から自己ベストと達成を再計算します。
          </p>
          <Button
            onClick={remove}
            isDisabled={pending}
            type="button"
            color="danger"
            variant="flat"
            className="max-w-full whitespace-normal"
            isLoading={pending}
          >
            入力と結果を削除する
          </Button>
          <Button
            onClick={() => {
              setConfirmation(null);
              setMessage("");
            }}
            isDisabled={pending}
            type="button"
            color="default"
            variant="light"
            className="max-w-full whitespace-normal"
            isLoading={pending}
          >
            キャンセル
          </Button>
        </>
      ) : (
        <Button
          onClick={() => setConfirmation({ key: crypto.randomUUID() })}
          type="button"
          color="danger"
          variant="flat"
          className="max-w-full whitespace-normal"
        >
          記録を削除
        </Button>
      )}
      <p
        role="status"
        className="empty:hidden rounded-lg bg-default-100 p-3 text-sm text-foreground"
      >
        {message}
      </p>
    </div>
  );
}
export function PracticeConditionsLabel(properties: {
  conditions: PracticeHistoryData["items"][number]["conditions"];
}) {
  const value = properties.conditions;
  return (
    <p>
      {value.mode === "GAME" ? "ゲーム" : "練習"}・トラック{value.trackId + 1}
      ・小節{value.rangeStartBar}〜{value.rangeEndBar}・テンポ比
      {value.tempoScale}・補正{value.calibrationUs / 1000}ms・ルール
      {value.ruleVersion}
    </p>
  );
}
export function PracticeHistory(properties: { history: PracticeHistoryData }) {
  return (
    <Card
      aria-label="本人の演奏履歴"
      as="section"
      className="min-w-0 overflow-visible border border-divider bg-content1"
    >
      <CardBody className="min-w-0 space-y-4 p-4 sm:p-6">
        <p>完了回数: {properties.history.completedCount}</p>
        {properties.history.items.length === 0 && (
          <p>保存した演奏はありません。</p>
        )}
        {properties.history.items.map((item) => (
          <article key={item.id}>
            <h2 className="text-xl font-semibold">
              <HeroLink
                href={`/practice/${item.id}`}
                className="rounded-small text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
              >
                楽譜{item.scoreId}・版{item.revisionNumber}の記録
              </HeroLink>
            </h2>
            <p>
              {new Date(item.startedAt).toLocaleString("ja-JP")}・
              {item.status === "INTERRUPTED"
                ? "中断（完了数に含めません）"
                : "完了"}
            </p>
            <PracticeConditionsLabel conditions={item.conditions} />
            <p>
              音高正確率:{" "}
              {item.summary.pitchAccuracy === null
                ? "評価不可"
                : `${(item.summary.pitchAccuracy * 100).toFixed(1)}%`}
              ・平均時刻ずれ:{" "}
              {item.summary.meanAbsTimingUs === null
                ? "評価不可"
                : `${(item.summary.meanAbsTimingUs / 1000).toFixed(1)}ms`}
              {item.score === null ? "" : `・得点${item.score.toFixed(1)}`}
            </p>
            {item.isBest && <p>自己ベスト</p>}
            {item.achievements.includes("FIRST_COMPLETION") && (
              <p>達成: 最初の完了</p>
            )}
            {item.achievements.includes("PERSONAL_BEST") && (
              <p>達成: 自己ベスト更新</p>
            )}
            {item.canReadScore ? (
              <HeroLink
                href={`/score/${item.scoreId}?revisionId=${item.revisionId}`}
                className="rounded-small text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
              >
                使用した楽譜の版を見る
              </HeroLink>
            ) : (
              <p>
                楽譜本文は現在閲覧できません。本人の記録要約は保持しています。
              </p>
            )}
            <PracticeDelete sessionId={item.id} />
          </article>
        ))}
        {properties.history.nextCursor && (
          <HeroLink
            href={`/practice/history?cursor=${encodeURIComponent(properties.history.nextCursor)}`}
            className="rounded-small text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
          >
            次の50件
          </HeroLink>
        )}
      </CardBody>
    </Card>
  );
}
