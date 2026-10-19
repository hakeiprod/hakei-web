import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthenticatedContent } from "@/components/authenticated-content";
import { FormCreateScore } from "@/components/form-create-score";
import { prisma } from "@/prisma";
import { currentActor } from "@/server/auth";
import { repositoryAccess } from "@/server/authorization";
export default async function Create(properties: {
  searchParams: Promise<{
    repositoryId?: string;
  }>;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/api/auth/signin?callbackUrl=%2Fscore%2Fcreate");
  const { repositoryId } = await properties.searchParams;
  if (!repositoryId)
    return (
      <main className="mx-auto w-full min-w-0 max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          楽譜を作成
        </h1>
        <p>保存先のリポジトリを選んでください。</p>
        <Link
          href="/repositories"
          className="rounded-small text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
        >
          リポジトリ一覧へ
        </Link>
      </main>
    );
  const access = await repositoryAccess(prisma, repositoryId, actor.id);
  if (!access.canEdit)
    return (
      <main className="mx-auto w-full min-w-0 max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          楽譜を作成
        </h1>
        <p
          role="status"
          className="rounded-large border border-divider bg-content1 p-4 text-foreground"
        >
          このリポジトリでは楽譜を作成できません。
        </p>
      </main>
    );
  return (
    <main className="mx-auto w-full min-w-0 max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        {access.repository.name}に楽譜を保存
      </h1>
      <AuthenticatedContent actorId={actor.id}>
        <FormCreateScore repositoryId={repositoryId} />
      </AuthenticatedContent>
    </main>
  );
}
