import { expect, it } from "vitest";
import { emailSchema, passwordSchema, credentialsSchema } from "./input";

it("normalizes email without merging aliases", () => {
  expect(emailSchema.parse(" Player+practice@Example.COM ")).toBe(
    "player+practice@example.com",
  );
  expect(emailSchema.parse("player@example.com")).not.toBe(
    emailSchema.parse("player+practice@example.com"),
  );
});
it.each([
  "a@example.com\r\n",
  "a@example.com,b@example.com",
  "invalid",
  "Name <a@example.com>",
])("rejects unsafe email input", (value) => {
  expect(emailSchema.safeParse(value).success).toBe(false);
});
it("counts Unicode code points and preserves the exact password", () => {
  for (const value of [
    "🎵".repeat(15),
    "x".repeat(128),
    "  My password  🎵  ",
    "e\u0301".repeat(8),
  ]) {
    expect(passwordSchema.parse(value)).toBe(value);
  }
  for (const value of ["🎵".repeat(14), "x".repeat(129)]) {
    expect(passwordSchema.safeParse(value).success).toBe(false);
  }
});
it("does not accept client identity, role or generation as credentials", () => {
  expect(
    credentialsSchema.safeParse({
      email: "a@example.com",
      password: "a".repeat(15),
      userId: "administrator",
      role: "ADMIN",
      authVersion: 999,
    }).success,
  ).toBe(false);
});
