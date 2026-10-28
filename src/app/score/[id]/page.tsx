import { CardBody, Card } from "@heroui/card";
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
    <main className="mx-auto w-full min-w-0 max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        楽譜 {score.id}
      </h1>
      <ShowScore
        score={score}
        canPlay={score.artifacts?.validation.canPractice ?? false}
      />
      {score.artifacts?.issues.some(
        (issue) => issue.status === "UNRESOLVED",
      ) && (
        <Card
          aria-label="変換の確認事項"
          as="section"
          className="min-w-0 overflow-visible border border-divider bg-content1 [contain-intrinsic-block-size:auto_160px] [content-visibility:auto]"
        >
          <CardBody className="min-w-0 space-y-4 p-4 sm:p-6">
            {score.artifacts?.issues
              .filter((issue) => issue.status === "UNRESOLVED")
              .map((issue) => (
                <p
                  key={issue.id}
                  className="[contain-intrinsic-block-size:auto_1lh] [content-visibility:auto]"
                >
                  {issue.severity === "BLOCKING"
                    ? "演奏に使えない箇所"
                    : "確認事項"}
                  : {issue.message}
                </p>
              ))}
          </CardBody>
        </Card>
      )}
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
            className="rounded-small text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
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
            className="rounded-small text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
          >
            この版でリズムゲームをする
          </Link>
        </p>
      )}
      <Card
        as="section"
        className="min-w-0 overflow-visible border border-divider bg-content1 [contain-intrinsic-block-size:auto_160px] [content-visibility:auto]"
      >
        <CardBody className="min-w-0 space-y-4 p-4 sm:p-6">
          <h2 className="text-xl font-semibold">履歴</h2>
          <ul>
            {history.map((revision) => (
              <li key={revision.id}>
                <Link
                  href={`/score/${score.id}?revisionId=${revision.id}`}
                  className="rounded-small text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
                >
                  版 {revision.number}
                </Link>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      <Card
        as="section"
        className="min-w-0 overflow-visible border border-divider bg-content1 [contain-intrinsic-block-size:auto_160px] [content-visibility:auto]"
      >
        <CardBody className="min-w-0 space-y-4 p-4 sm:p-6">
          <h2 className="text-xl font-semibold">編集案</h2>
          <ul>
            {proposals.map((proposal) => (
              <li key={proposal.id}>
                <Link
                  href={`/repositories/${score.repositoryId}/proposals/${proposal.id}`}
                  className="rounded-small text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
                >
                  {proposal.summary}
                </Link>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
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
