import { CardMusic } from "@/components/card-music";
import { prisma } from "@/prisma";

export default async function Musics() {
  const musics = await prisma.music.findMany({ include: { resource: true } });
  return (
    <>
      {musics.map((music) => (
        <CardMusic key={music.id} data={music} />
      ))}
    </>
  );
}
