import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Auth } from "@auth/core";
import { expect, it, vi } from "vitest";
import { withTestConnections } from "../testing/database";
import { authenticationEnvironment } from "../testing/authentication";
import { authenticationConfig } from "./config";
import { authenticationOptions } from "./authjs";
import { authenticationRequest } from "./maintenance";
import { revokeSession } from "./sessions";
import { hashPassword } from "./password";
import { beginGithubReauth } from "./github-reauth";
import {
  requestPasswordAddition,
  confirmPasswordAddition,
} from "./password-addition";

it("runs real SDK OAuth, recovers creation, reauthenticates and adds Credentials to the same user", () =>
  withTestConnections(async (database) => {
    const root = await mkdtemp(path.join(tmpdir(), "hakei-oauth-sdk-"));
    vi.stubEnv("SCORE_GIT_ROOT", root);
    const environment = {
      ...authenticationEnvironment(),
      AUTH_GITHUB_ID: "fixture-client",
      AUTH_GITHUB_SECRET: "fixture-secret",
      AUTH_RATE_SECRET: randomUUID() + randomUUID(),
    };
    const email = `${randomUUID()}@example.invalid`;
    let profileId = randomUUID();
    let providerEmail = email;
    let emailOnlyId: string | undefined;
    let repositoryId: string | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(async (input) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url === "https://github.com/login/oauth/access_token")
          return Response.json({
            access_token: "fixture-token",
            token_type: "bearer",
            scope: "read:user user:email",
          });
        if (url === "https://api.github.com/user")
          return Response.json({
            id: profileId,
            login: "fixture",
            name: "Fixture",
            email: providerEmail,
            avatar_url: null,
          });
        throw new Error("Unexpected external request in fixture");
      }),
    );
    const options = {
      ...authenticationOptions(database, environment),
      secret: "test-only-oauth-fixture-secret",
      trustHost: true,
      basePath: "/api/auth",
    };
    const cookies = new Map<string, string>();
    async function call(operation: string, body?: Record<string, string>) {
      const request = new Request(
        `http://localhost:3000/api/auth/${operation}`,
        {
          method: body ? "POST" : "GET",
          headers: {
            cookie: [...cookies]
              .map(([key, value]) => `${key}=${value}`)
              .join("; "),
            ...(body
              ? { "content-type": "application/x-www-form-urlencoded" }
              : {}),
          },
          body: body ? new URLSearchParams(body) : undefined,
        },
      );
      const response = await authenticationRequest(request, () =>
        Auth(request, options),
      );
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(";")[0],
          separator = pair.indexOf("=");
        if (pair.slice(separator + 1))
          cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
        else cookies.delete(pair.slice(0, separator));
      }
      return response;
    }
    async function oauth(tamper = false) {
      const csrfResponse = await call("csrf");
      const { csrfToken } = await csrfResponse.json();
      const start = await call("signin/github", {
        csrfToken,
        callbackUrl: "http://localhost:3000/account/security",
      });
      expect(start.status).toBe(302);
      const authorization = new URL(start.headers.get("location")!);
      expect(authorization.hostname).toBe("github.com");
      expect(authorization.searchParams.get("code_challenge")).toBeTruthy();
      const parameters = new URLSearchParams({ code: "fixture-code" });
      const state = authorization.searchParams.get("state");
      expect(state).toBeTruthy();
      if (state) parameters.set("state", tamper ? state + "invalid" : state);
      return call(`callback/github?${parameters}`);
    }
    try {
      await oauth(true);
      expect(await database.user.count({ where: { email } })).toBe(0);
      const link = vi.spyOn(options.adapter!, "linkAccount");
      link.mockImplementationOnce(async () => {
        throw new Error("simulated failure before link");
      });
      await oauth();
      const pending = await database.oAuthCreationReceipt.findUniqueOrThrow({
        where: {
          provider_providerAccountId: {
            provider: "github",
            providerAccountId: profileId,
          },
        },
      });
      expect(pending.status).toBe("PENDING");
      expect(await database.user.count({ where: { email } })).toBe(1);
      const retry = await oauth();
      expect(retry.headers.get("location")).toBe(
        "http://localhost:3000/account/security",
      );
      const visible = await call("session");
      const session = await visible.json();
      expect(session.user.id).toBe(pending.userId);
      const actor = {
        sub: session.user.id as string,
        sid: session.sid as string,
        authVersion: session.authVersion as number,
      };
      const repository = await database.scoreRepository.create({
        data: {
          name: "OAuth fixture",
          ownerId: actor.sub,
          gitStorageKey: randomUUID(),
        },
      });
      repositoryId = repository.id;
      await database.trustSnapshot.create({
        data: {
          userId: actor.sub,
          ruleId: "fixture",
          inputVersion: 0,
          score: 42,
        },
      });
      await database.user.update({
        where: { id: actor.sub },
        data: { serviceRole: "OPERATOR" },
      });
      const accountId = profileId;
      profileId = randomUUID();
      await oauth();
      expect(
        await database.account.count({ where: { userId: actor.sub } }),
      ).toBe(1);
      profileId = accountId;
      const updateCsrf = await call("csrf");
      const updateCsrfBody = await updateCsrf.json();
      await call("session", {
        csrfToken: updateCsrfBody.csrfToken,
        data: JSON.stringify({
          provider: "github",
          nonce: "forged-client-proof",
        }),
      });
      expect(
        await database.reauthIntent.count({ where: { userId: actor.sub } }),
      ).toBe(0);
      await beginGithubReauth(database, actor, environment);
      await oauth();
      const refreshed = await call("session");
      const newSession = await refreshed.json();
      expect(newSession.sid).not.toBe(actor.sid);
      const proof = await database.reauthIntent.findFirstOrThrow({
        where: { userId: actor.sub },
      });
      expect(proof.currentSid).toBe(newSession.sid);
      expect(proof.completedAt).not.toBeNull();
      const config = authenticationConfig(environment);
      if (!config.enabled) throw new Error("expected config");
      let token = "";
      await requestPasswordAddition(
        database,
        config,
        { sub: actor.sub, sid: newSession.sid, authVersion: 0 },
        environment,
        randomUUID(),
        {
          sendChallenge: async (_email, value) => {
            token = value;
            return { accepted: true };
          },
        },
      );
      await confirmPasswordAddition(
        database,
        { sub: actor.sub, sid: newSession.sid, authVersion: 0 },
        { token, newPassword: "owner-selected-password" },
        environment,
        randomUUID(),
      );
      const expired = await call("session");
      expect(await expired.json()).toBeNull();
      const csrfResponse = await call("csrf");
      const { csrfToken } = await csrfResponse.json();
      await call("callback/credentials", {
        csrfToken,
        email,
        password: "owner-selected-password",
      });
      const loggedIn = await call("session");
      const returning = await loggedIn.json();
      expect(returning.user.id).toBe(actor.sub);
      expect(returning.authVersion).toBe(1);
      const unchanged = await database.user.findUniqueOrThrow({
        where: { id: actor.sub },
      });
      expect(unchanged.serviceRole).toBe("OPERATOR");
      const owned = await database.scoreRepository.findUniqueOrThrow({
        where: { id: repositoryId },
      });
      expect(owned.ownerId).toBe(actor.sub);
      const trust = await database.trustSnapshot.findUniqueOrThrow({
        where: { userId: actor.sub },
      });
      expect(trust.score).toBe(42);
      await beginGithubReauth(
        database,
        { sub: actor.sub, sid: returning.sid, authVersion: 1 },
        environment,
      );
      await revokeSession(database, returning.sid);
      const sessionCount = await database.authSessionRecord.count({
        where: { userId: actor.sub },
      });
      await oauth();
      expect(
        await database.authSessionRecord.count({
          where: { userId: actor.sub },
        }),
      ).toBe(sessionCount);
      const staleProof = await database.reauthIntent.findFirstOrThrow({
        where: { userId: actor.sub, originSid: returning.sid },
      });
      expect(staleProof.completedAt).toBeNull();
      cookies.delete("authjs.session-token");
      await oauth();
      const githubAgain = await call("session");
      const githubIdentity = await githubAgain.json();
      expect(githubIdentity.user.id).toBe(actor.sub);
      expect(githubIdentity.authVersion).toBe(1);
      cookies.delete("authjs.session-token");
      const emailOnly = await database.user.create({
        data: {
          email: `${randomUUID()}@example.invalid`,
          passwordCredential: {
            create: { passwordHash: await hashPassword("email-only-password") },
          },
        },
      });
      emailOnlyId = emailOnly.id;
      await database.emailIdentity.create({
        data: {
          userId: emailOnly.id,
          normalizedEmail: emailOnly.email!,
          state: "VERIFIED",
        },
      });
      const emailCsrf = await call("csrf");
      const emailCsrfBody = await emailCsrf.json();
      await call("callback/credentials", {
        csrfToken: emailCsrfBody.csrfToken,
        email: emailOnly.email!,
        password: "email-only-password",
      });
      profileId = randomUUID();
      providerEmail = emailOnly.email!;
      await oauth();
      expect(
        await database.account.count({ where: { userId: emailOnly.id } }),
      ).toBe(0);
      expect(
        await database.user.count({ where: { email: emailOnly.email } }),
      ).toBe(1);
    } finally {
      if (repositoryId)
        await database.scoreRepository.deleteMany({
          where: { id: repositoryId },
        });
      const existing = await database.user.findUnique({ where: { email } });
      if (existing)
        await database.trustSnapshot.deleteMany({
          where: { userId: existing.id },
        });
      if (emailOnlyId)
        await database.user.deleteMany({ where: { id: emailOnlyId } });
      await database.user.deleteMany({ where: { email } });
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
      await rm(root, { recursive: true, force: true });
    }
  }));
