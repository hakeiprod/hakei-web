import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/prisma";
import { validateSession } from "./authentication/sessions";

export async function currentActor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return validateSession(prisma, {
    sub: session.user.id,
    sid: session.sid,
    authVersion: session.authVersion,
  });
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
