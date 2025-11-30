import { ShowScoreRythme } from "@/components/show-score-rythme";
import { prisma } from "@/prisma";
import { notFound } from "next/navigation";

export default async function Score(props: PageProps<"/score/[id]">) {
  const score = await prisma.score.findUnique({
    where: { id: Number((await props.params).id) },
  });
  if (!score) return notFound();
  return <ShowScoreRythme score={score} />;
}
