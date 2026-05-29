import { ShowScore } from "@/components/show-score";
import { prisma } from "@/prisma";
import { notFound } from "next/navigation";

export default async function Score(properties: PageProps<"/score/[id]">) {
  const parameters = await properties.params;
  const score = await prisma.score.findUnique({
    where: { id: Number(parameters.id) },
  });
  if (!score) return notFound();
  return (
    <>
      <ShowScore score={score} />;
    </>
  );
}
