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
        <main className="mx-auto w-full min-w-0 max-w-7xl space-y-6 px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            信頼度と評価
          </h1>
          <UserTrust userId={actor.id} />
          {actor.serviceRole === "OPERATOR" && (
            <Link
              href="/admin/trust"
              className="rounded-small text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
            >
              運営設定へ
            </Link>
          )}
        </main>
      </AuthenticatedContent>
    </>
  );
}
