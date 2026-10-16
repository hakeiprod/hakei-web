import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { Auth } from "@auth/core";
import { encode } from "next-auth/jwt";
import { withTestConnections } from "../testing/database";
import { createSession } from "./sessions";
import { authenticationRequest } from "./maintenance";
import { guardAuthRequest } from "./http";
import { providerAvailability } from "./providers";
import { authenticationOptions } from "./authjs";

it("uses standard JWT session handling but refuses a revoked DB sid", () =>
  withTestConnections(async (database) => {
    const root = await mkdtemp(path.join(tmpdir(), "hakei-auth-sdk-"));
    vi.stubEnv("SCORE_GIT_ROOT", root);
    const user = await database.user.create({
      data: { email: `${randomUUID()}@example.invalid` },
    });
    try {
      const session = await createSession(database, {
        userId: user.id,
        authVersion: 0,
        method: "github",
      });
      const secret = "test-only-auth-secret-not-for-deployment";
      const config = {
        ...authenticationOptions(database, {}),
        secret,
        trustHost: true,
        basePath: "/api/auth",
      };
      const token = await encode({
        secret,
        salt: "authjs.session-token",
        token: { sub: user.id, sid: session.sid, authVersion: 0 },
      });
      const request = () =>
        new Request("http://localhost/api/auth/session", {
          headers: { cookie: `authjs.session-token=${token}` },
        });
      const before = await Auth(request(), config);
      const visible = await before.json();
      expect(visible.user.id).toBe(user.id);
      expect(visible.sid).toBe(session.sid);
      const csrf = await Auth(
        new Request("http://localhost/api/auth/csrf"),
        config,
      );
      const csrfData = await csrf.json();
      const cookie = [
        `authjs.session-token=${token}`,
        ...csrf.headers.getSetCookie().map((value) => value.split(";")[0]),
      ].join("; ");
      const updated = await Auth(
        new Request("http://localhost/api/auth/session", {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            csrfToken: csrfData.csrfToken,
            data: { sid: "forged", authVersion: 999, role: "ADMIN" },
          }),
        }),
        config,
      );
      const unchanged = await updated.json();
      expect(unchanged.sid).toBe(session.sid);
      expect(unchanged.authVersion).toBe(0);
      expect(
        await database.authSessionRecord.count({ where: { userId: user.id } }),
      ).toBe(1);
      const signedOut = await Auth(
        new Request("http://localhost/api/auth/signout", {
          method: "POST",
          headers: {
            cookie,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ csrfToken: csrfData.csrfToken }),
        }),
        config,
      );
      expect(signedOut.status).toBe(302);
      const revoked = await database.authSessionRecord.findUniqueOrThrow({
        where: { sid: session.sid },
      });
      expect(revoked.revokedAt).not.toBeNull();
      const after = await Auth(request(), config);
      expect(await after.json()).toBeNull();
      const unavailable = vi
        .spyOn(database, "$transaction")
        .mockRejectedValue(new Error("test-only DB outage"));
      try {
        const checked = await authenticationRequest(request(), async () => {
          const result = await Auth(request(), config);
          await expect(
            Promise.resolve().then(() => config.adapter!.getUser!(user.id)),
          ).rejects.toThrow("UNAUTHENTICATED");
          return result;
        });
        expect(checked.status).toBe(503);
        expect(checked.headers.has("set-cookie")).toBe(false);
      } finally {
        unavailable.mockRestore();
      }

      const providers = await Auth(
        new Request("http://localhost/api/auth/providers"),
        config,
      );
      expect(await providers.json()).not.toHaveProperty("github");
      for (const environment of [
        {},
        { AUTH_GITHUB_ID: "test-only-id" },
        { AUTH_GITHUB_SECRET: "test-only-secret" },
      ]) {
        const optional = {
          ...authenticationOptions(database, environment),
          secret,
          trustHost: true,
          basePath: "/api/auth",
        };
        const providerList = await Auth(
          new Request("http://localhost/api/auth/providers"),
          optional,
        );
        expect(await providerList.json()).not.toHaveProperty("github");
        const standard = vi.fn((value: Request) => Auth(value, optional));
        for (const method of ["GET", "POST"]) {
          const rejected = await guardAuthRequest(
            new Request(
              "http://localhost/api/auth/callback/github?code=test-only-code",
              { method },
            ),
            standard,
            providerAvailability(environment).github,
          );
          expect(rejected.status).toBe(404);
        }
        expect(standard).not.toHaveBeenCalled();
      }
      expect(await database.account.count({ where: { userId: user.id } })).toBe(
        0,
      );
      expect(
        await database.authSessionRecord.count({ where: { userId: user.id } }),
      ).toBe(1);
    } finally {
      await database.user.delete({ where: { id: user.id } });
      vi.unstubAllEnvs();
      await rm(root, { recursive: true, force: true });
    }
  }));
