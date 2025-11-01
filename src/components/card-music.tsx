import { Prisma } from "@/generated/prisma/client";
import { Card } from "@heroui/card";
import Link from "next/link";

export function CardMusic({
  data: {
    id,
    resource: { name },
  },
}: {
  data: Prisma.MusicGetPayload<{
    include: { resource: true };
  }>;
}) {
  return (
    <Card>
      <Link href={`/music/${id}`}>{name}</Link>
    </Card>
  );
}
