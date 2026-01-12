import { Header } from "@/components/header";
import { prisma } from "@/prisma";
import Link from "next/link";

export default async function Home() {
  const scores = await prisma.score.findMany({ select: { id: true } });
  return (
    <>
      <Header />
      Home
      {scores.map((score) => (
        <li key={score.id}>
          <Link href={`score/${score.id}`}>{score.id}</Link>
        </li>
      ))}
    </>
  );
}
