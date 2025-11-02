import { Prisma } from "@/generated/prisma/client";
import { Card } from "@heroui/card";
import Link from "next/link";

export function CardAlbum({
  data: {
    id,
    resource: { name },
  },
}: {
  data: Prisma.AlbumGetPayload<{
    include: { resource: true };
  }>;
}) {
  return (
    <Card>
      <Link href={`/album/${id}`}>{name}</Link>
    </Card>
  );
}
