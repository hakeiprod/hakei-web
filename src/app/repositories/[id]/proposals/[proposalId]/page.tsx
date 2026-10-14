import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/prisma";
import { currentActor } from "@/server/auth";
import { readProposal } from "@/server/proposal-reader";
import { scoreGitStore } from "@/server/score-reader";
import { AuthenticatedContent } from "@/components/authenticated-content";
import { ProposalEditor } from "@/components/proposal-editor";
import { ProposalActions } from "@/components/proposal-actions";
import { ShowScore } from "@/components/show-score";
export default async function Proposal(properties: {
  params: Promise<{ id: string; proposalId: string }>;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/api/auth/signin");
  const { id, proposalId } = await properties.params;
  const proposal = await readProposal(
    prisma,
    scoreGitStore(),
    proposalId,
    actor.id,
  ).catch((error) => {
    if (error instanceof Error && error.message === "NOT_FOUND") notFound();
    throw error;
  });
  if (proposal.repositoryId !== id) notFound();
  const states: Record<string, string> = {
    DRAFT: "下書き",
    SUBMITTED: "提出済み",
    MERGED: "採用済み",
    REJECTED: "却下",
    CONFLICTED: "基準版が更新されています",
    WITHDRAWN: "取り下げ済み",
  };
  return (
    <AuthenticatedContent actorId={actor.id}>
      <main>
        <h1>編集案: {proposal.summary}</h1>
        <p>{states[proposal.status] ?? proposal.status}</p>
        <Link href={`/score/${proposal.scoreId}`}>現在の楽譜へ</Link>
        {proposal.status === "CONFLICTED" && (
          <p>
            現在の楽譜を確認して、新しい基準版から編集案を作成してください。
          </p>
        )}
        {proposal.canEdit ? (
          <ProposalEditor
            repositoryId={proposal.repositoryId}
            scoreId={proposal.scoreId}
            baseRevisionId={proposal.baseRevisionId}
            initial={proposal.candidate}
            proposalId={proposal.id}
            expectedVersion={proposal.version}
            summary={proposal.summary}
          />
        ) : (
          <>
            <h2>変更前</h2>
            <ShowScore score={{ data: proposal.base }} />
            <h2>変更後</h2>
            <ShowScore score={{ data: proposal.candidate }} />
          </>
        )}
        <ProposalActions
          proposalId={proposal.id}
          version={proposal.version}
          baseRevisionId={proposal.baseRevisionId}
          baseRepositoryCommitOid={proposal.baseRepositoryCommitOid}
          status={proposal.status}
          canMerge={proposal.canMerge}
          mergeReason={proposal.mergeReason}
          canWithdraw={proposal.canWithdraw}
        />
      </main>
    </AuthenticatedContent>
  );
}
