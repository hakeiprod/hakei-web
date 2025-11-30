import { prisma } from "@/prisma";
import { notFound } from "next/navigation";
import { ShowScore } from "@/components/show-score";

export default async function Score(props: PageProps<"/score/[id]">) {
  const score = await prisma.score.findUnique({
    where: { id: Number((await props.params).id) },
  });
  if (!score) return notFound();
  return <ShowScore score={score} />;
}
