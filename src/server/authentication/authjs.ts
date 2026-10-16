import "server-only";
import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { decode } from "next-auth/jwt";
import { protectedOAuthAdapter } from "./adapter";
import { githubSession } from "./github-reauth";
import type { PrismaClient } from "../../generated/prisma/client";
import { configuredWriteLease } from "../maintenance-gate";
import { authenticationContext } from "./request-context";
import { maintenanceAdapter } from "../maintenance-adapter";
import { authorizeCredentials } from "./credentials";
import { githubSettings } from "./providers";
import {
  createSession,
  validateSessionStrict,
  revokeSession,
} from "./sessions";

export function authenticationOptions(
  database: PrismaClient,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): NextAuthConfig {
  const github = githubSettings(environment);
  const adapter = new Proxy(
    maintenanceAdapter(protectedOAuthAdapter(database, environment)),
    {
      get(target, key, receiver) {
        const value = Reflect.get(target, key, receiver);
        if (typeof value !== "function") return value;
        return (...parameters: unknown[]) => {
          if (
            authenticationContext()?.databaseUnavailable ||
            authenticationContext()?.sessionRejected
          )
            throw new Error("UNAUTHENTICATED");
          return Reflect.apply(value, target, parameters);
        };
      },
    },
  );
  return {
    adapter,
    providers: [
      ...(github
        ? [
            GitHub({
              ...github,
              checks: ["pkce", "state"],
              allowDangerousEmailAccountLinking: false,
            }),
          ]
        : []),
      Credentials({
        credentials: {
          email: { label: "メールアドレス", type: "email" },
          password: { label: "パスワード", type: "password" },
        },
        authorize: (credentials, request) =>
          authorizeCredentials(
            database,
            environment,
            { email: credentials.email, password: credentials.password },
            request.headers,
          ),
      }),
    ],
    logger: { error: () => console.error({ event: "authentication-failed" }) },
    session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
    jwt: {
      async decode(parameters) {
        const token = await decode(parameters);
        if (!token) return null;
        try {
          const actor = await validateSessionStrict(database, token);
          const context = authenticationContext();
          if (!actor && context) context.sessionRejected = true;
          if (actor && context && !context.incoming) context.incoming = actor;
          return actor ? token : null;
        } catch (error) {
          const context = authenticationContext();
          if (context) context.databaseUnavailable = true;
          throw error;
        }
      },
    },
    callbacks: {
      async signIn({ account, profile }) {
        if (account?.provider !== "github")
          return account?.provider === "credentials";
        const context = authenticationContext();
        if (
          !githubSettings(environment) ||
          !context ||
          !profile ||
          account.type !== "oauth" ||
          !account.providerAccountId
        )
          return false;
        context.github = { providerAccountId: account.providerAccountId };
        return true;
      },
      async jwt({ token, user, account }) {
        if (
          authenticationContext()?.databaseUnavailable ||
          authenticationContext()?.sessionRejected
        )
          throw new Error("UNAUTHENTICATED");
        if (!user) return token;
        if (
          !user.id ||
          !account ||
          !["github", "credentials"].includes(account.provider)
        )
          return null;
        const userId = user.id;
        const current = await database.user.findUniqueOrThrow({
          where: { id: userId },
        });
        const method =
          account.provider === "credentials" ? "credentials" : "github";
        const context = authenticationContext();
        if (
          method === "github" &&
          context?.github?.providerAccountId !== account.providerAccountId
        )
          throw new Error("UNAUTHENTICATED");
        const incoming = context?.incoming;
        const version =
          method === "credentials" ? user.authVersion : current.authVersion;
        if (version === undefined) return null;
        const session = await configuredWriteLease(() =>
          method === "github"
            ? githubSession(
                database,
                userId,
                account.providerAccountId,
                incoming
                  ? {
                      sub: incoming.id,
                      sid: incoming.sid,
                      authVersion: incoming.authVersion,
                    }
                  : undefined,
                environment,
              )
            : createSession(database, {
                userId,
                authVersion: version,
                method,
                credentialVersion: user.credentialVersion,
              }),
        );
        return {
          ...token,
          sub: userId,
          sid: session.sid,
          authVersion: session.authVersion,
        };
      },
      session({ session, token }) {
        if (!token.sub || !token.sid || typeof token.authVersion !== "number")
          throw new Error("UNAUTHENTICATED");
        session.user.id = token.sub;
        session.sid = token.sid;
        session.authVersion = token.authVersion;
        return session;
      },
    },
    events: {
      async signOut(message) {
        if ("token" in message && typeof message.token?.sid === "string")
          await configuredWriteLease(() =>
            revokeSession(database, message.token!.sid!),
          );
      },
    },
  };
}
