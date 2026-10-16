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
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revisionId?: string }>;
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
    return <p>この版は未解決の問題があるためゲームで利用できません。</p>;
  const rule = await readEvaluationRule(prisma, 1);
  return (
    <>
      <Header />
      <AuthenticatedContent actorId={actor.id}>
        <main>
          <h1>
            楽譜{score.id}・版{score.revisionNumber}のリズムゲーム
          </h1>
          <ShowScore score={score} canPlay={false} />
          <RhythmGame key={score.revisionId} score={score} rule={rule} />
        </main>
      </AuthenticatedContent>
    </>
  );
}
