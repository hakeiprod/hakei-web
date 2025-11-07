import { prisma } from "@/prisma";

export default async function Reosurce({ params }: { params: { id: string } }) {
  const { id } = await params;
  const resource = await prisma.resource.findUnique({
    where: { id: Number(id) },
    include: { music: true, artist: true, album: true },
  });
  return <>{resource?.name}</>;
}
