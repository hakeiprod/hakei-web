import { randomUUID } from "node:crypto";
import { Auth } from "@auth/core";
import { expect, it, vi } from "vitest";
import { withCollaboration } from "../testing/collaboration";
import { initializeEvaluationRule } from "../evaluation-rule";
import { savePractice } from "../practice";
import { authenticationEnvironment } from "../testing/authentication";
import { authenticationOptions } from "./authjs";
import { hashPassword } from "./password";
import { providerAvailability } from "./providers";
import { guardAuthRequest } from "./http";
async function sdkCall(
  cookies: Map<string, string>,
  options: ReturnType<typeof authenticationOptions>,
  github: boolean,
  operation: string,
  body?: Record<string, string>,
) {
  const request = new Request(`http://localhost:3000/api/auth/${operation}`, {
    method: body ? "POST" : "GET",
    headers: {
      cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; "),
      ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body ? new URLSearchParams(body) : undefined,
  });
  const response = await guardAuthRequest(
    request,
    (request) => Auth(request, options),
    github,
  );
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0],
      split = pair.indexOf("=");
    if (pair.slice(split + 1))
      cookies.set(pair.slice(0, split), pair.slice(split + 1));
    else cookies.delete(pair.slice(0, split));
  }
  return response;
}
it("preserves account, role, score, trust and actual practice history across provider restarts", () =>
  withCollaboration(async (fixture) => {
    const database = fixture.database;
    const email = `${randomUUID()}@example.invalid`;
    const password = "provider-transition-password";
    await database.user.update({
      where: { id: fixture.ownerId },
      data: { email },
    });
    await database.passwordCredential.create({
      data: {
        userId: fixture.ownerId,
        passwordHash: await hashPassword(password),
      },
    });
    await database.emailIdentity.create({
      data: {
        userId: fixture.ownerId,
        normalizedEmail: email,
        state: "VERIFIED",
      },
    });
    await database.account.create({
      data: {
        userId: fixture.ownerId,
        provider: "github",
        providerAccountId: randomUUID(),
        type: "oauth",
      },
    });
    await initializeEvaluationRule(database);
    await savePractice(database, fixture.git, fixture.ownerId, {
      clientSessionId: randomUUID(),
      scoreId: fixture.scoreId,
      scoreRevisionId: fixture.revisionId,
      conditions: {
        trackId: 0,
        rangeStartBar: 1,
        rangeEndBar: 1,
        tempoScale: 1,
        calibrationUs: 0,
        mode: "PRACTICE",
        ruleVersion: 1,
      },
      status: "COMPLETED",
      endedUs: 2_150_000,
      eventBatches: [],
    });
    await database.trustSnapshot.upsert({
      where: { userId: fixture.ownerId },
      create: {
        userId: fixture.ownerId,
        ruleId: "fixture",
        inputVersion: 0,
        score: 31,
      },
      update: { score: 31 },
    });
    async function snapshot() {
      return {
        user: await database.user.findUniqueOrThrow({
          where: { id: fixture.ownerId },
          include: { accounts: true, passwordCredential: true },
        }),
        repository: await database.scoreRepository.findUniqueOrThrow({
          where: { id: fixture.repositoryId },
        }),
        trust: await database.trustSnapshot.findUniqueOrThrow({
          where: { userId: fixture.ownerId },
        }),
        history: await database.practiceSession.findMany({
          where: { userId: fixture.ownerId },
        }),
      };
    }
    const before = await snapshot();
    const cookies = new Map<string, string>();
    const external = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("simulated external provider outage"));
    vi.stubGlobal("fetch", external);
    const base = {
      ...authenticationEnvironment(),
      AUTH_RATE_SECRET: randomUUID() + randomUUID(),
    };
    try {
      for (const github of [
        {},
        { AUTH_GITHUB_ID: "partial" },
        { AUTH_GITHUB_ID: "fixture", AUTH_GITHUB_SECRET: "fixture" },
        {},
        { AUTH_GITHUB_ID: "fixture", AUTH_GITHUB_SECRET: "fixture" },
        {},
      ]) {
        const environment = { ...base, ...github };
        const options = {
          ...authenticationOptions(database, environment),
          secret: "test-only-transition-secret",
          trustHost: true,
          basePath: "/api/auth",
        };
        const call = sdkCall.bind(
          null,
          cookies,
          options,
          providerAvailability(environment).github,
        );
        const providersResponse = await call("providers");
        const providers = await providersResponse.json();
        expect(Boolean(providers.github)).toBe(
          providerAvailability(environment).github,
        );
        if (!providerAvailability(environment).github) {
          const disabled = await call("signin/github");
          expect(disabled.status).toBe(404);
        }
        const csrfResponse = await call("csrf");
        const { csrfToken } = await csrfResponse.json();
        await call("callback/credentials", { csrfToken, email, password });
        const response = await call("session");
        const session = await response.json();
        expect(session.user.id).toBe(fixture.ownerId);
        expect(await snapshot()).toEqual(before);
        if (!providerAvailability(environment).github) {
          await call("signout", { csrfToken });
          const loggedOut = await call("session");
          expect(await loggedOut.json()).toBeNull();
        }
      }
      expect(external).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  }));
