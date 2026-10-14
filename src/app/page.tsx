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
      <main>
        <h1>楽譜</h1>
        {scores.length === 0 ? (
          <p>閲覧できる楽譜がありません。</p>
        ) : (
          <ul>
            {scores.map((score) => (
              <li key={score.id}>
                <Link href={`/score/${score.id}`}>
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
