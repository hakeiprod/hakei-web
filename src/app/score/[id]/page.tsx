import Link from "next/link";
import ScoreEdit from "@/components/score-edit";
import { Header } from "@/components/header";
import { AuthenticatedContent } from "@/components/authenticated-content";
import { ShowScore } from "@/components/show-score";
import { prisma } from "@/prisma";
import { currentActor } from "@/server/auth";
import { readScore, scoreGitStore } from "@/server/score-reader";
import { notFound } from "next/navigation";
export default async function Score(properties: PageProps<"/score/[id]">) {
  const parameters = await properties.params;
  const actor = await currentActor();
  const search = await properties.searchParams;
  const revisionId =
    typeof search.revisionId === "string" ? search.revisionId : undefined;
  const score = await readScore(
    prisma,
    scoreGitStore(),
    Number(parameters.id),
    actor?.id,
    revisionId,
  ).catch((error) => {
    if (error instanceof Error && error.message === "NOT_FOUND") notFound();
    throw error;
  });
  const history = await prisma.scoreRevision.findMany({
    where: { scoreId: score.id, repositoryId: score.repositoryId },
    orderBy: { number: "desc" },
    take: 50,
    select: { id: true, number: true },
  });
  const proposals = await prisma.editProposal.findMany({
    where: {
      scoreId: score.id,
      OR: [
        { status: { not: "DRAFT" } },
        ...(actor ? [{ authorId: actor.id }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, summary: true },
  });
  const content = (
    <main>
      <h1>楽譜 {score.id}</h1>
      <ShowScore
        score={score}
        canPlay={score.artifacts?.validation.canPractice ?? false}
      />
      <section aria-label="変換の確認事項">
        {score.artifacts?.issues
          .filter((issue) => issue.status === "UNRESOLVED")
          .map((issue) => (
            <p key={issue.id}>
              {issue.severity === "BLOCKING"
                ? "演奏に使えない箇所"
                : "確認事項"}
              : {issue.message}
            </p>
          ))}
      </section>
      {actor && (
        <AuthenticatedContent actorId={actor.id}>
          <ScoreEdit
            scoreId={score.id}
            revisionId={score.revisionId}
            canEdit={score.canEdit}
            canManage={score.canManage}
          />
        </AuthenticatedContent>
      )}
      <p>
        {score.artifacts?.validation.canPractice ? (
          <Link
            href={`/score/${score.id}/practice?revisionId=${score.revisionId}`}
          >
            この版を練習する
          </Link>
        ) : (
          "この版は練習・ゲームに利用できません。"
        )}
      </p>
      {score.artifacts?.validation.canGame && (
        <p>
          <Link
            href={`/score/${score.id}/rythme?revisionId=${score.revisionId}`}
          >
            この版でリズムゲームをする
          </Link>
        </p>
      )}
      <section>
        <h2>履歴</h2>
        <ul>
          {history.map((revision) => (
            <li key={revision.id}>
              <Link href={`/score/${score.id}?revisionId=${revision.id}`}>
                版 {revision.number}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>編集案</h2>
        <ul>
          {proposals.map((proposal) => (
            <li key={proposal.id}>
              <Link
                href={`/repositories/${score.repositoryId}/proposals/${proposal.id}`}
              >
                {proposal.summary}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
  return (
    <>
      <Header />
      {score.requiresAuthentication && actor ? (
        <AuthenticatedContent actorId={actor.id}>
          {content}
        </AuthenticatedContent>
      ) : (
        content
      )}
    </>
  );
}
