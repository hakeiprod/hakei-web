import { expect, it } from "vitest";
import { requestSource } from "./rate-limit";

it("ignores forwarded input unless a trusted proxy has overwritten the dedicated header", () => {
  const headers = new Headers({
    "x-auth-client-ip": "192.0.2.1",
    "x-forwarded-for": "198.51.100.1",
  });
  expect(requestSource(headers, false)).toBe("unknown");
  expect(requestSource(headers, true)).toBe("192.0.2.1");
  expect(
    requestSource(new Headers({ "x-forwarded-for": "198.51.100.1" }), true),
  ).toBe("unknown");
  expect(
    requestSource(
      new Headers({ "x-auth-client-ip": "192.0.2.1, 198.51.100.1" }),
      true,
    ),
  ).toBe("unknown");
  expect(
    requestSource(
      new Headers({ "x-auth-client-ip": "2001:0db8:0:0:0:0:0:1" }),
      true,
    ),
  ).toBe("[2001:db8::1]");
});
