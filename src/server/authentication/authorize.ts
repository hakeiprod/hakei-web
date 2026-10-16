import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma } from "../../generated/prisma/client";
import { lockSession } from "./sessions";

type Actor = {
  id: string;
  sid: string;
  authVersion: number;
  serviceRole: string;
};
type Resolver = (actorId: string) => Promise<Actor | null>;
const authorization = new AsyncLocalStorage<Resolver>();

/** Trusted server entry points supply the actor returned by currentActor. */
export function withActorAuthorization<T>(
  actor: Actor,
  operation: () => Promise<T>,
) {
  return withActorResolver(
    async (id) => (id === actor.id ? actor : null),
    operation,
  );
}
/** Also used by dedicated DB fixtures to simulate authenticated users. */
export function withActorResolver<T>(
  resolver: Resolver,
  operation: () => Promise<T>,
) {
  return authorization.run(resolver, operation);
}
export async function verifyTransactionActor(
  transaction: Prisma.TransactionClient,
  actorId: string,
) {
  const resolver = authorization.getStore();
  const actor = resolver ? await resolver(actorId) : null;
  if (!actor || actor.id !== actorId) throw new Error("UNAUTHENTICATED");
  return lockSession(transaction, {
    sub: actor.id,
    sid: actor.sid,
    authVersion: actor.authVersion,
  });
}
