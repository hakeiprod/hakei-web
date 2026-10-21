import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/prisma";

export async function currentActor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, serviceRole: true },
  });
}
export async function requireActor() {
  const actor = await currentActor();
  if (!actor) throw new Error("UNAUTHENTICATED");
  return actor;
}
export async function requireOperator() {
  const actor = await requireActor();
  if (actor.serviceRole !== "OPERATOR") throw new Error("FORBIDDEN");
  return actor;
}
