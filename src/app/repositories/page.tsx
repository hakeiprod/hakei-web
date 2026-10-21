import { CardBody, Card } from "@heroui/card";
import Link from "next/link";
import { AuthenticatedContent } from "@/components/authenticated-content";
import { Header } from "@/components/header";
import { RepositoryCreate } from "@/components/repository-create";
import { RepositoryMembers } from "@/components/repository-members";
import { prisma } from "@/prisma";
import { currentActor } from "@/server/auth";
import { listRepositories } from "@/server/repositories";
const visibilityNames: Record<string, string> = {
  PRIVATE: "管理者のみ",
  INVITED: "招待メンバー",
  PUBLIC: "公開",
};
export default async function Repositories() {
  const actor = await currentActor();
  const repositories = await listRepositories(prisma, actor?.id);
  const sections = await Promise.all(
    repositories.map(async (repository) => {
      const members =
        repository.canManage && actor
          ? await prisma.repositoryMember.findMany({
              where: { repositoryId: repository.id },
              select: { userId: true, role: true, canMerge: true },
            })
          : [];
      const content = (
        <Card
          as="section"
          className="min-w-0 overflow-visible border border-divider bg-content1"
        >
          <CardBody className="min-w-0 space-y-4 p-4 sm:p-6">
            <h2 className="text-xl font-semibold">{repository.name}</h2>
            <p>
              閲覧: {visibilityNames[repository.visibility]} · 編集:{" "}
              {repository.canEdit ? "可能" : "不可"} · マージ:{" "}
              {repository.editScope === "ALL_USERS"
                ? "信頼度の基準によって判定"
                : repository.canMergeInvited
                  ? "可能"
                  : "不可"}
            </p>
            {repository.canEdit && actor && (
              <AuthenticatedContent actorId={actor.id}>
                <Link
                  href={`/score/create?repositoryId=${repository.id}`}
                  className="rounded-small text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
                >
                  楽譜を取り込む
                </Link>
              </AuthenticatedContent>
            )}
            {repository.canManage && actor && (
              <AuthenticatedContent actorId={actor.id}>
                <RepositoryMembers
                  repositoryId={repository.id}
                  accessVersion={repository.accessVersion}
                  visibility={repository.visibility}
                  editScope={repository.editScope}
                  members={members}
                />
              </AuthenticatedContent>
            )}
          </CardBody>
        </Card>
      );
      return (
        <div key={repository.id}>
          {repository.visibility !== "PUBLIC" && actor ? (
            <AuthenticatedContent actorId={actor.id}>
              {content}
            </AuthenticatedContent>
          ) : (
            content
          )}
        </div>
      );
    }),
  );
  return (
    <>
      <Header />
      <main className="mx-auto w-full min-w-0 max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          リポジトリ
        </h1>
        {actor ? (
          <AuthenticatedContent actorId={actor.id}>
            <RepositoryCreate />
          </AuthenticatedContent>
        ) : (
          <p>ログインするとリポジトリを作成できます。</p>
        )}
        {repositories.length === 0 && <p>閲覧できるリポジトリがありません。</p>}
        {sections}
      </main>
    </>
  );
}
