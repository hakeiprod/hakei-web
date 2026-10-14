import { redirect } from "next/navigation";
import { prisma } from "@/prisma";
import { currentActor } from "@/server/auth";
import { listPractice } from "@/server/practice-history";
import { AuthenticatedContent } from "@/components/authenticated-content";
import { Header } from "@/components/header";
import { PracticeHistory } from "@/components/practice-history";
export default async function History(properties: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/api/auth/signin");
  const { cursor } = await properties.searchParams;
  const history = await listPractice(
    prisma,
    actor.id,
    cursor ? { cursor } : {},
  );
  return (
    <>
      <Header />
      <AuthenticatedContent actorId={actor.id}>
        <main>
          <h1>自分の演奏履歴</h1>
          <PracticeHistory history={history} />
        </main>
      </AuthenticatedContent>
    </>
  );
}
