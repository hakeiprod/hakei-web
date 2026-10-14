import { GameResult } from "@/components/game-result";
import { gameSummarySchema } from "@/s-core/models/practice/game-contracts";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/prisma";
import { currentActor } from "@/server/auth";
import { readPractice } from "@/server/practice-history";
import { scoreGitStore } from "@/server/score-reader";
import { AuthenticatedContent } from "@/components/authenticated-content";
import { Header } from "@/components/header";
import { PracticeAnalysis } from "@/components/practice-analysis";
import { analysisSchema } from "@/s-core/models/practice/analysis-contracts";
import {
  PracticeConditionsLabel,
  PracticeDelete,
} from "@/components/practice-history";
import { ShowScore } from "@/components/show-score";
export default async function PracticeResult(properties: {
  params: Promise<{ id: string }>;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/api/auth/signin");
  const { id } = await properties.params;
  const result = await readPractice(
    prisma,
    scoreGitStore(),
    actor.id,
    id,
  ).catch((error) => {
    if (error instanceof Error && error.message === "NOT_FOUND") notFound();
    throw error;
  });
  return (
    <>
      <Header />
      <AuthenticatedContent actorId={actor.id}>
        <main>
          <h1>演奏結果</h1>
          <Link href="/practice/history">自分の演奏履歴</Link>
          <PracticeConditionsLabel conditions={result.conditions} />
          <p>
            {result.status === "INTERRUPTED"
              ? "中断した記録です。完了数・自己ベストには含めません。"
              : "完了した記録です。"}
          </p>
          {result.isBest && <p>自己ベスト</p>}
          {result.conditions.mode === "GAME" && (
            <GameResult
              game={gameSummarySchema.parse(result.evaluation.summary).game}
              provisional={false}
              interrupted={result.status === "INTERRUPTED"}
            />
          )}
          <PracticeAnalysis
            analysis={analysisSchema.parse(result.evaluation)}
          />
          {result.score ? (
            <ShowScore score={result.score} canPlay={false} />
          ) : (
            <p>楽譜本文は現在閲覧できません。</p>
          )}
          <PracticeDelete sessionId={result.id} />
        </main>
      </AuthenticatedContent>
    </>
  );
}
