import { redirect, notFound } from "next/navigation";
import { prisma } from "@/prisma";
import { currentActor } from "@/server/auth";
import { readScore, scoreGitStore } from "@/server/score-reader";
import { readEvaluationRule } from "@/server/evaluation-rule";
import { RhythmGame } from "@/components/rhythm-game";
import { ShowScore } from "@/components/show-score";
import { AuthenticatedContent } from "@/components/authenticated-content";
import { Header } from "@/components/header";
export default async function Game(properties: {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    revisionId?: string;
  }>;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/api/auth/signin");
  const { id } = await properties.params,
    { revisionId } = await properties.searchParams;
  const score = await readScore(
    prisma,
    scoreGitStore(),
    Number(id),
    actor.id,
    revisionId,
  ).catch((error) => {
    if (error instanceof Error && error.message === "NOT_FOUND") notFound();
    throw error;
  });
  if (!score.artifacts?.validation.canGame)
    return (
      <main className="mx-auto w-full min-w-0 max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          楽譜{score.id}・版{score.revisionNumber}のリズムゲーム
        </h1>
        <p
          role="status"
          className="rounded-large border border-divider bg-content1 p-4 text-foreground"
        >
          この版は未解決の問題があるためゲームで利用できません。
        </p>
      </main>
    );
  const rule = await readEvaluationRule(prisma, 1);
  return (
    <>
      <Header />
      <AuthenticatedContent actorId={actor.id}>
        <main className="mx-auto w-full min-w-0 max-w-7xl space-y-6 px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            楽譜{score.id}・版{score.revisionNumber}のリズムゲーム
          </h1>
          <ShowScore score={score} canPlay={false} />
          <RhythmGame key={score.revisionId} score={score} rule={rule} />
        </main>
      </AuthenticatedContent>
    </>
  );
}
