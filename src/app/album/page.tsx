import { CardAlbum } from "@/components/card-album";
import { prisma } from "@/prisma";

export default async function Albums() {
  const albums = await prisma.album.findMany({ include: { resource: true } });
  return (
    <>
      {albums.map((album) => (
        <CardAlbum key={album.id} data={album} />
      ))}
    </>
  );
}
