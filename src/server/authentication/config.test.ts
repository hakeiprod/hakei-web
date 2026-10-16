import { describe, expect, it } from "vitest";
import { authenticationEnvironment } from "../testing/authentication";
import { authenticationConfig } from "./config";

describe("authentication settings", () => {
  it("does not require email or GitHub settings while disabled", () => {
    expect(authenticationConfig({})).toEqual({ enabled: false });
  });
  it("supports email without GitHub credentials", () => {
    const value = authenticationConfig(authenticationEnvironment());
    expect(value.enabled).toBe(true);
    if (!value.enabled) throw new Error("expected enabled settings");
    expect(value.publicOrigin).toBe("http://localhost:3000");
    expect(value.limits).toEqual({
      loginMailbox: 5,
      loginSource: 20,
      sendMailbox: 3,
      sendSource: 10,
    });
    expect(value.smtp.requireTLS).toBe(true);
    expect(value.trustedProxy).toBe(false);
  });
  it.each([
    "http://example.com",
    "https://example.com/path",
    "https://user:password@example.com",
    "https://example.com/?secret=value",
  ])("rejects an unsafe public origin: %s", (origin) => {
    expect(() =>
      authenticationConfig({
        ...authenticationEnvironment(),
        AUTH_PUBLIC_ORIGIN: origin,
      }),
    ).toThrow();
  });
  it("rejects invalid mail headers, partial credentials and invalid limits", () => {
    for (const change of [
      { SMTP_FROM: "sender@example.invalid\r\nBcc: other@example.invalid" },
      { SMTP_USER: "test" },
      { AUTH_LOGIN_MAILBOX_LIMIT: "0" },
      { AUTH_RATE_SECRET: "short" },
    ]) {
      expect(() =>
        authenticationConfig({ ...authenticationEnvironment(), ...change }),
      ).toThrow();
    }
  });
});
