import ScoreEdit from "@/components/score-edit";
import { ShowScore } from "@/components/show-score";
import { prisma } from "@/prisma";
import { notFound, redirect } from "next/navigation";

async function handleDelete(id: number) {
  "use server";
  await prisma.score.delete({ where: { id } });
  redirect(`/`);
}
export default async function Score(properties: PageProps<"/score/[id]">) {
  const parameters = await properties.params;
  const score = await prisma.score.findUnique({
    where: { id: Number(parameters.id) },
  });
  if (!score) return notFound();
  return (
    <>
      <ShowScore score={score} />
      <ScoreEdit onDelete={handleDelete} />
    </>
  );
}
