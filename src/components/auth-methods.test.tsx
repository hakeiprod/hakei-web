import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EmailRegistration } from "./email-registration";
import { PasswordAddition } from "./password-addition";
import { providerAvailability } from "../server/authentication/providers";
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));
afterEach(cleanup);
it.each([
  {},
  { AUTH_GITHUB_ID: "partial" },
  { AUTH_GITHUB_ID: "fixture", AUTH_GITHUB_SECRET: "private-fixture-value" },
  {},
])(
  "renders only the methods from the current public availability",
  (environment) => {
    const availability = providerAvailability(environment);
    render(
      <>
        <EmailRegistration githubAvailable={availability.github} />
        <PasswordAddition githubAvailable={availability.github} />
      </>,
    );
    expect(
      Boolean(screen.queryByRole("button", { name: "GitHubでログイン" })),
    ).toBe(availability.github);
    expect(
      Boolean(screen.queryByRole("button", { name: "GitHubで本人確認" })),
    ).toBe(availability.github);
    expect(screen.getByLabelText("メールアドレス")).toBeDefined();
    expect(document.body.textContent).not.toContain("private-fixture-value");
  },
);
