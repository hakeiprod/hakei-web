import { expect, it } from "vitest";
import { githubSettings, providerAvailability } from "./providers";

it.each([
  {},
  { AUTH_GITHUB_ID: "id" },
  { AUTH_GITHUB_SECRET: "secret" },
  { AUTH_GITHUB_ID: "", AUTH_GITHUB_SECRET: "secret" },
  { AUTH_GITHUB_ID: "id", AUTH_GITHUB_SECRET: "   " },
  { AUTH_GITHUB_ID: "\t", AUTH_GITHUB_SECRET: "secret" },
])("disables incomplete or blank GitHub settings", (environment) => {
  expect(githubSettings(environment)).toBeNull();
  expect(providerAvailability(environment)).toEqual({ github: false });
});
it("preserves credentials while exposing only availability", () => {
  const environment = {
    AUTH_GITHUB_ID: " client ",
    AUTH_GITHUB_SECRET: " secret ",
  };
  expect(githubSettings(environment)).toEqual({
    clientId: " client ",
    clientSecret: " secret ",
  });
  expect(providerAvailability(environment)).toEqual({ github: true });
  expect(JSON.stringify(providerAvailability(environment))).not.toContain(
    "secret",
  );
});
