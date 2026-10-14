import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/prisma";

export async function currentActor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, serviceRole: true },
  });
  return user;
}
export async function requireActor() {
  const user = await currentActor();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
export async function requireOperator() {
  const actor = await requireActor();
  if (actor.serviceRole !== "OPERATOR") throw new Error("FORBIDDEN");
  return actor;
}
