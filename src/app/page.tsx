import { Header } from "@/components/header";
import { prisma } from "@/prisma";
import { currentActor } from "@/server/auth";
import { listScores } from "@/server/score-reader";
import Link from "next/link";
export default async function Home() {
  const actor = await currentActor();
  const scores = await listScores(prisma, actor?.id);
  return (
    <>
      <Header />
      <main className="mx-auto w-full min-w-0 max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">楽譜</h1>
        {scores.length === 0 ? (
          <p>閲覧できる楽譜がありません。</p>
        ) : (
          <ul>
            {scores.map((score) => (
              <li key={score.id}>
                <Link
                  href={`/score/${score.id}`}
                  className="rounded-small text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
                >
                  {score.repositoryName} · 楽譜 {score.id}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
