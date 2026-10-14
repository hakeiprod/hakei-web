import { redirect } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/server/auth";
import { Header } from "@/components/header";
import { AuthenticatedContent } from "@/components/authenticated-content";
import { UserTrust } from "@/components/user-trust";
export default async function Trust() {
  const actor = await currentActor();
  if (!actor) redirect("/api/auth/signin");
  return (
    <>
      <Header />
      <AuthenticatedContent actorId={actor.id}>
        <main>
          <h1>信頼度と評価</h1>
          <UserTrust userId={actor.id} />
          {actor.serviceRole === "OPERATOR" && (
            <Link href="/admin/trust">運営設定へ</Link>
          )}
        </main>
      </AuthenticatedContent>
    </>
  );
}
