import { notFound, redirect } from "next/navigation";
import { AuthenticatedContent } from "@/components/authenticated-content";
import { sheetScoreSchema } from "@/s-core/models/import/score-schema";
import { partialScoreSchema } from "@/s-core/models/import/contracts";
import { PartialScoreEditor } from "@/components/partial-score-editor";
import { FormCreateScore } from "@/components/form-create-score";
import { ProposalEditor } from "@/components/proposal-editor";
import { prisma } from "@/prisma";
import { currentActor } from "@/server/auth";
import { readScore, scoreGitStore } from "@/server/score-reader";
export default async function Edit(properties: {
  params: Promise<{ id: string }>;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/api/auth/signin");
  const { id } = await properties.params;
  const score = await readScore(
    prisma,
    scoreGitStore(),
    Number(id),
    actor.id,
  ).catch((error) => {
    if (error instanceof Error && error.message === "NOT_FOUND") notFound();
    throw error;
  });
  if (!score.canEdit) return <p>編集する権限がありません。</p>;
  return (
    <AuthenticatedContent actorId={actor.id}>
      <main>
        <h1>楽譜 {score.id} の編集案</h1>
        {partialScoreSchema.safeParse(score.data).success ? (
          <PartialScoreEditor
            repositoryId={score.repositoryId}
            scoreId={score.id}
            baseRevisionId={score.revisionId}
            initial={score.data}
          />
        ) : sheetScoreSchema.safeParse(score.data).success ? (
          <ProposalEditor
            repositoryId={score.repositoryId}
            scoreId={score.id}
            baseRevisionId={score.revisionId}
            initial={score.data}
          />
        ) : (
          <p>
            この版の形式を表示できません。対応する楽譜ファイルから修正案を作成してください。
          </p>
        )}
        <details>
          <summary>別の楽譜ファイルから修正案を作成</summary>
          <FormCreateScore
            repositoryId={score.repositoryId}
            scoreId={score.id}
            baseRevisionId={score.revisionId}
          />
        </details>
      </main>
    </AuthenticatedContent>
  );
}
