import { randomUUID } from "node:crypto";
import NextAuth from "next-auth";
import { NextRequest } from "next/server";
import { afterEach, expect, it, vi } from "vitest";
import { authenticationOptions } from "./authjs";
import { withTestConnections } from "../testing/database";
import { withCollaboration } from "../testing/collaboration";
import { savePractice } from "../practice";
import { initializeEvaluationRule } from "../evaluation-rule";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function client(
  database: Parameters<typeof authenticationOptions>[0],
  server = process.env.TEST_EMAIL_SERVER,
) {
  if (!server || !process.env.TEST_MAILPIT_URL)
    throw new Error(
      "Set TEST_EMAIL_SERVER and TEST_MAILPIT_URL to a dedicated Mailpit instance",
    );
  const options = {
    ...authenticationOptions(database, {
      EMAIL_SERVER: server,
      EMAIL_FROM: "sender@example.invalid",
    }),
    secret: "test-only-standard-email-secret",
    trustHost: true,
    basePath: "/api/auth",
  };
  const { handlers } = NextAuth(options);
  const cookies = new Map<string, string>();
  async function call(path: string, body?: Record<string, string>) {
    const response = await (body ? handlers.POST : handlers.GET)(
      new NextRequest(new URL(path, "http://localhost:3000"), {
        method: body ? "POST" : "GET",
        headers: {
          cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
          ...(body
            ? { "content-type": "application/x-www-form-urlencoded" }
            : {}),
        },
        body: body ? new URLSearchParams(body) : undefined,
      }),
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
  async function json(path: string) {
    const response = await call(path);
    return response.json();
  }
  async function requestLink(email: string) {
    const { csrfToken } = await json("/api/auth/csrf");
    const response = await call("/api/auth/signin/nodemailer", {
      csrfToken,
      email,
      callbackUrl: "http://localhost:3000/",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("verify-request");
    const inbox = new URL("/api/v1/messages", process.env.TEST_MAILPIT_URL);
    const inboxResponse = await fetch(inbox);
    const messages = (await inboxResponse.json()) as {
      messages: { ID: string; To: { Address: string }[] }[];
    };
    const captured = messages.messages.find((message) =>
      message.To.some((to) => to.Address === email),
    );
    expect(captured).toBeDefined();
    const messageResponse = await fetch(
      new URL(`/api/v1/message/${captured!.ID}`, inbox),
    );
    const message = (await messageResponse.json()) as { Text: string };
    const deletion = await fetch(new URL("/api/v1/messages", inbox), {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ IDs: [captured!.ID] }),
    });
    expect(deletion.ok).toBe(true);
    const deletedMessage = await fetch(
      new URL(`/api/v1/message/${captured!.ID}`, inbox),
    );
    expect(deletedMessage.status).toBe(404);
    const link = message.Text.split("\n")
      .map((line) => line.trim())
      .find((line) =>
        line.startsWith("http://localhost:3000/api/auth/callback/nodemailer"),
      );
    expect(link).toBeDefined();
    return link!;
  }
  return { call, json, requestLink, cookies };
}
it("standard SDK creates a user only after ownership verification, stores a hashed single-use token and logs out a DB session", async () =>
  withTestConnections(async (database) => {
    vi.stubEnv("SCORE_GIT_ROOT", "/tmp/hakei-standard-email-test-git");
    const email = `${randomUUID()}@example.invalid`;
    const browser = client(database);
    try {
      const link = await browser.requestLink(email);
      expect(await database.user.findUnique({ where: { email } })).toBeNull();
      const token = await database.verificationToken.findFirstOrThrow({
        where: { identifier: email },
      });
      expect(token.token).not.toBe(new URL(link).searchParams.get("token"));
      const altered = new URL(link);
      altered.searchParams.set("token", "invalid-token");
      await browser.call(altered.toString());
      expect(await browser.json("/api/auth/session")).toBeNull();
      const callback = await browser.call(link);
      expect(callback.status).toBe(302);
      const user = await database.user.findUniqueOrThrow({ where: { email } });
      expect(user.emailVerified).not.toBeNull();
      const session = await browser.json("/api/auth/session");
      expect(session.user.id).toBe(user.id);
      expect(await database.session.count({ where: { userId: user.id } })).toBe(
        1,
      );
      const { csrfToken } = await browser.json("/api/auth/csrf");
      await browser.call("/api/auth/signout", { csrfToken });
      expect(await browser.json("/api/auth/session")).toBeNull();
      expect(await database.session.count({ where: { userId: user.id } })).toBe(
        0,
      );
      await browser.call(link);
      expect(await browser.json("/api/auth/session")).toBeNull();
    } finally {
      await database.verificationToken.deleteMany({
        where: { identifier: email },
      });
      await database.user.deleteMany({ where: { email } });
    }
  }));
it("rejects expired links and unrecognized legacy JWT cookies", async () =>
  withTestConnections(async (database) => {
    vi.stubEnv("SCORE_GIT_ROOT", "/tmp/hakei-standard-email-test-git");
    const email = `${randomUUID()}@example.invalid`;
    const browser = client(database);
    try {
      const link = await browser.requestLink(email);
      await database.verificationToken.updateMany({
        where: { identifier: email },
        data: { expires: new Date(0) },
      });
      await browser.call(link);
      expect(await browser.json("/api/auth/session")).toBeNull();
      browser.cookies.set("authjs.session-token", "legacy.jwt.value");
      expect(await browser.json("/api/auth/session")).toBeNull();
      expect(await database.user.findUnique({ where: { email } })).toBeNull();
    } finally {
      await database.verificationToken.deleteMany({
        where: { identifier: email },
      });
    }
  }));
it("email login retains the existing GitHub user, role, score ownership, trust and actual practice history", async () =>
  withCollaboration(async (fixture) => {
    const database = fixture.database;
    vi.stubEnv("SCORE_GIT_ROOT", fixture.root);
    const email = `${randomUUID()}@example.invalid`;
    await database.user.update({
      where: { id: fixture.ownerId },
      data: { email },
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
        accounts: await database.account.findMany({
          where: { userId: fixture.ownerId },
        }),
        repository: await database.scoreRepository.findUnique({
          where: { id: fixture.repositoryId },
        }),
        trust: await database.trustSnapshot.findUnique({
          where: { userId: fixture.ownerId },
        }),
        history: await database.practiceSession.findMany({
          where: { userId: fixture.ownerId },
        }),
      };
    }
    const before = await snapshot();
    const browser = client(database);
    try {
      await browser.call(await browser.requestLink(email));
      const session = await browser.json("/api/auth/session");
      expect(session.user.id).toBe(fixture.ownerId);
      const user = await database.user.findUniqueOrThrow({
        where: { id: fixture.ownerId },
      });
      expect(user.serviceRole).toBe("OPERATOR");
      expect(await snapshot()).toEqual(before);
    } finally {
      await database.verificationToken.deleteMany({
        where: { identifier: email },
      });
    }
  }));

it("does not authenticate when SMTP delivery fails", async () =>
  withTestConnections(async (database) => {
    vi.stubEnv("SCORE_GIT_ROOT", "/tmp/hakei-standard-email-test-git");
    const email = `${randomUUID()}@example.invalid`;
    const browser = client(
      database,
      "smtp://127.0.0.1:1?connectionTimeout=500",
    );
    try {
      const { csrfToken } = await browser.json("/api/auth/csrf");
      const response = await browser.call("/api/auth/signin/nodemailer", {
        csrfToken,
        email,
      });
      expect(response.headers.get("location")).toContain("error");
      expect(await browser.json("/api/auth/session")).toBeNull();
      expect(await database.user.findUnique({ where: { email } })).toBeNull();
    } finally {
      await database.verificationToken.deleteMany({
        where: { identifier: email },
      });
    }
  }));
