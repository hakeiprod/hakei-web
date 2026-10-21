// @vitest-environment node
import { expect, it } from "vitest";
import { authenticationOptions } from "./authjs";
import type { PrismaClient } from "../../generated/prisma/client";
const database = {} as PrismaClient;
it.each([
  {},
  { EMAIL_SERVER: "smtp://mailpit:1025" },
  { EMAIL_FROM: "sender@example.invalid" },
  { EMAIL_SERVER: " ", EMAIL_FROM: "sender@example.invalid" },
])("does not offer email with incomplete settings", (environment) => {
  expect(authenticationOptions(database, environment).providers).toHaveLength(
    0,
  );
});
it("uses standard email and database sessions without Credentials or custom JWT", () => {
  const config = authenticationOptions(database, {
    EMAIL_SERVER: "smtp://mailpit:1025",
    EMAIL_FROM: "sender@example.invalid",
  });
  expect(config.providers).toHaveLength(1);
  expect((config.providers[0] as { type: string }).type).toBe("email");
  expect((config.providers[0] as { id: string }).id).toBe("nodemailer");
  expect(config.session?.strategy).toBe("database");
  expect(config.jwt).toBeUndefined();
  expect(config.pages).toBeUndefined();
});
it.each([{}, { AUTH_GITHUB_ID: "partial" }, { AUTH_GITHUB_SECRET: "partial" }])(
  "hides GitHub when incomplete",
  (environment) => {
    expect(authenticationOptions(database, environment).providers).toHaveLength(
      0,
    );
  },
);
it("registers GitHub only with both settings", () => {
  const providers = authenticationOptions(database, {
    AUTH_GITHUB_ID: "fixture",
    AUTH_GITHUB_SECRET: "fixture",
  }).providers;
  expect(providers).toHaveLength(1);
  expect((providers[0] as { id: string }).id).toBe("github");
});

it.each([
  "invalid",
  "smtp://user:pass@smtp.example.invalid:587",
  "smtps://smtp.example.invalid:465",
  "smtps://user:pass@smtp.example.invalid:465?tls.rejectUnauthorized=false",
  "smtp://user:pass@smtp.example.invalid:587?requireTLS=true&ignoreTLS=true",
])("rejects unsafe production SMTP settings", (server) => {
  expect(() =>
    authenticationOptions(database, {
      NODE_ENV: "production",
      EMAIL_SERVER: server,
      EMAIL_FROM: "sender@example.invalid",
    }),
  ).toThrow("Invalid SMTP configuration");
});
it.each([
  "smtps://user:pass@smtp.example.invalid:465",
  "smtp://user:pass@smtp.example.invalid:587?requireTLS=true",
])("accepts encrypted authenticated production SMTP", (server) => {
  expect(
    authenticationOptions(database, {
      NODE_ENV: "production",
      EMAIL_SERVER: server,
      EMAIL_FROM: "sender@example.invalid",
    }).providers,
  ).toHaveLength(1);
});
it("does not enable email with only the old Resend settings", () => {
  expect(
    authenticationOptions(database, {
      AUTH_RESEND_KEY: "unused",
      EMAIL_FROM: "sender@example.invalid",
    }).providers,
  ).toHaveLength(0);
});

it.each([
  [{}, ["nodemailer"]],
  [{ AUTH_GITHUB_ID: "partial" }, ["nodemailer"]],
  [{ AUTH_GITHUB_SECRET: "partial" }, ["nodemailer"]],
  [
    { AUTH_GITHUB_ID: "fixture", AUTH_GITHUB_SECRET: "fixture" },
    ["nodemailer", "github"],
  ],
])("keeps SMTP independent of optional GitHub settings", (github, expected) => {
  const config = authenticationOptions(database, {
    EMAIL_SERVER: "smtp://mailpit:1025",
    EMAIL_FROM: "sender@example.invalid",
    ...github,
  });
  expect(
    config.providers.map((provider) =>
      typeof provider === "function" ? provider().id : provider.id,
    ),
  ).toEqual(expected);
  for (const provider of config.providers) {
    const options = typeof provider === "function" ? provider() : provider;
    expect(
      "allowDangerousEmailAccountLinking" in options &&
        options.allowDangerousEmailAccountLinking,
    ).not.toBe(true);
  }
});
