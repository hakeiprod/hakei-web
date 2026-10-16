import "server-only";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import type { PrismaClient, Prisma } from "../../generated/prisma/client";
import { authenticationContext } from "./request-context";
import { providerAvailability } from "./providers";
import { emailSchema } from "./input";
import { databaseNow } from "./rate-limit";

type Environment = Readonly<Record<string, string | undefined>>;
function verifiedAccount(environment: Environment) {
  const context = authenticationContext();
  if (
    !providerAvailability(environment).github ||
    context?.databaseUnavailable ||
    context?.sessionRejected ||
    !context?.github
  )
    throw new Error("UNAUTHENTICATED");
  return context.github.providerAccountId;
}
async function unusedUser(tx: Prisma.TransactionClient, userId: string) {
  const counts = await Promise.all([
    tx.account.count({ where: { userId } }),
    tx.passwordCredential.count({ where: { userId } }),
    tx.authSessionRecord.count({ where: { userId } }),
    tx.session.count({ where: { userId } }),
    tx.scoreRepository.count({ where: { ownerId: userId } }),
    tx.repositoryMember.count({ where: { userId } }),
    tx.scoreRevision.count({ where: { authorId: userId } }),
    tx.mergeRecord.count({ where: { actorId: userId } }),
    tx.trustRuleVersion.count({ where: { operatorId: userId } }),
    tx.editProposal.count({ where: { authorId: userId } }),
    tx.practiceSession.count({ where: { userId } }),
    tx.achievement.count({ where: { userId } }),
    tx.trustEvent.count({ where: { OR: [{ userId }, { actorId: userId }] } }),
    tx.userTrustReview.count({
      where: { OR: [{ reviewerId: userId }, { targetId: userId }] },
    }),
    tx.userTrustState.count({ where: { userId } }),
    tx.trustSnapshot.count({ where: { userId } }),
    tx.authChangeEvent.count({ where: { userId } }),
    tx.reauthIntent.count({ where: { userId } }),
    tx.importConversionLease.count({ where: { userId } }),
  ]);
  const user = await tx.user.findUnique({ where: { id: userId } });
  return (
    user?.serviceRole === "USER" &&
    user.authVersion === 0 &&
    counts.every((count) => count === 0)
  );
}
async function matchingUsers(tx: Prisma.TransactionClient, email: string) {
  const identity = await tx.emailIdentity.findUnique({
    where: { normalizedEmail: email },
    include: { user: true },
  });
  const users = await tx.user.findMany({ where: { email: { not: null } } });
  const matching = users.filter(
    (user) => emailSchema.safeParse(user.email).data === email,
  );
  if (identity?.user && !matching.some((user) => user.id === identity.userId))
    matching.push(identity.user);
  return matching;
}
/** Guard domain identity rules while retaining the standard adapter's other public operations. */
export function protectedOAuthAdapter(
  database: PrismaClient,
  environment: Environment,
): Adapter {
  const base = PrismaAdapter(database);
  return {
    ...base,
    async getUserByEmail(rawEmail) {
      const account = verifiedAccount(environment);
      const email = emailSchema.parse(rawEmail);
      return database.$transaction(async (tx) => {
        const users = await matchingUsers(tx, email);
        if (users.length > 1) throw new Error("UNAUTHENTICATED");
        const user = users[0];
        if (!user) return null;
        const receipt = await tx.oAuthCreationReceipt.findUnique({
          where: {
            provider_providerAccountId: {
              provider: "github",
              providerAccountId: account,
            },
          },
        });
        if (receipt?.status === "PENDING" && receipt.userId === user.id)
          return null;
        return user as AdapterUser;
      });
    },
    async createUser(profile) {
      const account = verifiedAccount(environment);
      if (authenticationContext()?.incoming) throw new Error("UNAUTHENTICATED");
      const email = profile.email ? emailSchema.parse(profile.email) : null;
      return database.$transaction(async (tx) => {
        await tx.$executeRaw`LOCK TABLE "users" IN SHARE ROW EXCLUSIVE MODE`;
        verifiedAccount(environment);
        const receipt = await tx.oAuthCreationReceipt.findUnique({
          where: {
            provider_providerAccountId: {
              provider: "github",
              providerAccountId: account,
            },
          },
        });
        if (receipt) {
          if (
            receipt.status !== "PENDING" ||
            !(await unusedUser(tx, receipt.userId))
          )
            throw new Error("UNAUTHENTICATED");
          const user = await tx.user.findUniqueOrThrow({
            where: { id: receipt.userId },
          });
          if (user.email !== email) throw new Error("UNAUTHENTICATED");
          const matches = email ? await matchingUsers(tx, email) : [];
          if (email && (matches.length !== 1 || matches[0].id !== user.id))
            throw new Error("UNAUTHENTICATED");
          return user as AdapterUser;
        }
        const existingEmails = email ? await matchingUsers(tx, email) : [];
        if (existingEmails.length > 0) throw new Error("UNAUTHENTICATED");
        const identity = email
          ? await tx.emailIdentity.upsert({
              where: { normalizedEmail: email },
              create: { normalizedEmail: email, state: "PENDING" },
              update: {},
            })
          : null;
        if (identity && (identity.userId || identity.state !== "PENDING"))
          throw new Error("UNAUTHENTICATED");
        const user = await tx.user.create({
          data: {
            email,
            name: profile.name,
            image: profile.image,
            serviceRole: "USER",
            emailVerified: null,
          },
        });
        if (identity) {
          await tx.authChallenge.updateMany({
            where: { head: { identityId: identity.id }, revokedAt: null },
            data: { revokedAt: await databaseNow(tx) },
          });
          await tx.emailIdentity.update({
            where: { id: identity.id },
            data: { userId: user.id, state: "OAUTH_BOUND" },
          });
        }
        await tx.oAuthCreationReceipt.create({
          data: {
            provider: "github",
            providerAccountId: account,
            userId: user.id,
          },
        });
        return user as AdapterUser;
      });
    },
    async linkAccount(account) {
      const providerAccountId = verifiedAccount(environment);
      if (
        account.provider !== "github" ||
        account.type !== "oauth" ||
        account.providerAccountId !== providerAccountId ||
        authenticationContext()?.incoming
      )
        throw new Error("UNAUTHENTICATED");
      await database.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${account.userId} FOR UPDATE`;
        verifiedAccount(environment);
        const receipt = await tx.oAuthCreationReceipt.findUnique({
          where: {
            provider_providerAccountId: {
              provider: "github",
              providerAccountId,
            },
          },
        });
        if (
          !receipt ||
          receipt.status !== "PENDING" ||
          receipt.userId !== account.userId ||
          !(await unusedUser(tx, account.userId))
        )
          throw new Error("UNAUTHENTICATED");
        await tx.account.create({
          data: {
            ...account,
            refresh_token: undefined,
            access_token: undefined,
            id_token: undefined,
          },
        });
        await tx.oAuthCreationReceipt.update({
          where: {
            provider_providerAccountId: {
              provider: "github",
              providerAccountId,
            },
          },
          data: { status: "APPLIED" },
        });
      });
    },
    async updateUser(profile) {
      verifiedAccount(environment);
      const current = await database.user.findUniqueOrThrow({
        where: { id: profile.id },
      });
      if (profile.email !== undefined && profile.email !== current.email)
        throw new Error("UNAUTHENTICATED");
      return current as AdapterUser;
    },
  };
}
