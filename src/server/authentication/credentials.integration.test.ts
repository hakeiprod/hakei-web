import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { Auth } from "@auth/core";
import { withTestConnections } from "../testing/database";
import { authenticationEnvironment } from "../testing/authentication";
import { authenticationConfig } from "./config";
import { authenticationOptions } from "./authjs";
import { requestRegistration, confirmRegistration } from "./registration";

it("registers, confirms and logs in/out through standard Credentials with one consistent failure code", () =>
  withTestConnections(async (database) => {
    const root = await mkdtemp(path.join(tmpdir(), "hakei-credentials-"));
    vi.stubEnv("SCORE_GIT_ROOT", root);
    const environment = {
      ...authenticationEnvironment(),
      AUTH_GITHUB_ID: "test-only-partial-configuration",
      AUTH_RATE_SECRET: randomUUID() + randomUUID(),
    };
    const config = authenticationConfig(environment);
    if (!config.enabled) throw new Error("expected config");
    const email = `${randomUUID()}@example.invalid`;
    const oauthOnly = await database.user.create({
      data: { email: `${randomUUID()}@example.invalid` },
    });
    let token = "";
    const mailer = {
      sendChallenge: async (_email: string, value: string) => {
        token = value;
        return { accepted: true };
      },
    };
    const options = {
      ...authenticationOptions(database, environment),
      secret: "test-only-credentials-secret-for-sdk",
      trustHost: true,
      basePath: "/api/auth",
    };
    const cookies = new Map<string, string>();
    async function call(operation: string, body?: Record<string, string>) {
      const response = await Auth(
        new Request(`http://localhost:3000/api/auth/${operation}`, {
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
        }),
        options,
      );
      for (const value of response.headers.getSetCookie()) {
        const pair = value.split(";")[0];
        const separator = pair.indexOf("=");
        const name = pair.slice(0, separator),
          content = pair.slice(separator + 1);
        if (content) cookies.set(name, content);
        else cookies.delete(name);
      }
      return response;
    }
    try {
      await requestRegistration(
        database,
        config,
        { email, password: "third-party-password" },
        randomUUID(),
        mailer,
      );
      const providers = await call("providers");
      expect(Object.keys(await providers.json())).toEqual(["credentials"]);
      const csrf = await call("csrf");
      const { csrfToken } = await csrf.json();
      const pending = await call("callback/credentials", {
        csrfToken,
        email,
        password: "third-party-password",
      });
      expect(pending.headers.get("location")).toContain("CredentialsSignin");
      await confirmRegistration(database, {
        token,
        newPassword: "owner-selected-password",
      });
      const wrong = await call("callback/credentials", {
        csrfToken,
        email,
        password: "third-party-password",
      });
      const unknown = await call("callback/credentials", {
        csrfToken,
        email: `${randomUUID()}@example.invalid`,
        password: "owner-selected-password",
      });
      const githubOnly = await call("callback/credentials", {
        csrfToken,
        email: oauthOnly.email!,
        password: "owner-selected-password",
      });
      expect(githubOnly.headers.get("location")).toBe(
        wrong.headers.get("location"),
      );
      expect(wrong.headers.get("location")).toBe(
        unknown.headers.get("location"),
      );
      const success = await call("callback/credentials", {
        csrfToken,
        email,
        password: "owner-selected-password",
        role: "ADMIN",
        authVersion: "999",
      });
      expect(success.status).toBe(302);
      const visible = await call("session");
      const session = await visible.json();
      const user = await database.user.findUniqueOrThrow({ where: { email } });
      expect(session.user.id).toBe(user.id);
      expect(user.serviceRole).toBe("USER");
      expect(session.authVersion).toBe(0);
      await call("signout", { csrfToken });
      const loggedOut = await call("session");
      expect(await loggedOut.json()).toBeNull();
      await call("callback/credentials", {
        csrfToken,
        email,
        password: "owner-selected-password",
      });
      const again = await call("session");
      const returning = await again.json();
      expect(returning.user.id).toBe(user.id);
    } finally {
      await database.user.delete({ where: { id: oauthOnly.id } });
      await database.user.deleteMany({ where: { email } });
      await database.emailIdentity.deleteMany({
        where: { normalizedEmail: email },
      });
      vi.unstubAllEnvs();
      await rm(root, { recursive: true, force: true });
    }
  }));
