import { prisma } from "@/prisma";

export default async function Music({ params }: { params: { id: string } }) {
  const { id } = await params;
  const music = await prisma.music.findUnique({
    where: { id: Number(id) },
    include: { resource: true },
  });
  return <>{music?.resource.name}</>;
}
