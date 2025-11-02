import { prisma } from "@/prisma";

export default async function Album({ params }: { params: { id: string } }) {
  const { id } = await params;
  const album = await prisma.album.findUnique({
    where: { id: Number(id) },
    include: { resource: true },
  });
  return <>{album?.resource.name}</>;
}
