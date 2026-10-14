import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthenticatedContent } from "@/components/authenticated-content";
import { FormCreateScore } from "@/components/form-create-score";
import { prisma } from "@/prisma";
import { currentActor } from "@/server/auth";
import { repositoryAccess } from "@/server/authorization";
export default async function Create(properties: {
  searchParams: Promise<{ repositoryId?: string }>;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/api/auth/signin?callbackUrl=%2Fscore%2Fcreate");
  const { repositoryId } = await properties.searchParams;
  if (!repositoryId)
    return (
      <main>
        <h1>楽譜を作成</h1>
        <p>保存先のリポジトリを選んでください。</p>
        <Link href="/repositories">リポジトリ一覧へ</Link>
      </main>
    );
  const access = await repositoryAccess(prisma, repositoryId, actor.id);
  if (!access.canEdit) return <p>このリポジトリでは楽譜を作成できません。</p>;
  return (
    <main>
      <h1>{access.repository.name}に楽譜を保存</h1>
      <AuthenticatedContent actorId={actor.id}>
        <FormCreateScore repositoryId={repositoryId} />
      </AuthenticatedContent>
    </main>
  );
}
