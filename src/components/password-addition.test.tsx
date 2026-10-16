import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PasswordAddition } from "./password-addition";
const signIn = vi.hoisted(() => vi.fn());
vi.mock("next-auth/react", () => ({ signIn }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("hides all addition controls when GitHub is unavailable", () => {
  render(<PasswordAddition githubAvailable={false} />);
  expect(screen.queryByRole("button")).toBeNull();
});
it("starts standard GitHub signIn only after a server intent is created", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      ok: true,
      requestId: "test",
      data: {
        code: "REAUTHENTICATION_STARTED",
        message: "再認証してください。",
      },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<PasswordAddition githubAvailable />);
  fireEvent.click(screen.getByRole("button", { name: "GitHubで本人確認" }));
  await vi.waitFor(() =>
    expect(signIn).toHaveBeenCalledWith("github", {
      redirectTo: "/account/security",
    }),
  );
  expect(fetcher.mock.calls[0][0]).toBe("/api/account-auth/beginGithubReauth");
});
it("explains a missing email without offering an unusable addition", () => {
  render(<PasswordAddition githubAvailable hasEmail={false} />);
  expect(
    screen.getByText("メールアドレスがないため、パスワードを追加できません。"),
  ).toBeDefined();
  expect(screen.queryByRole("button")).toBeNull();
});
it("shows a fixed retry message when standard signIn cannot start", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({
          ok: true,
          requestId: "test",
          data: {
            code: "REAUTHENTICATION_STARTED",
            message: "再認証してください。",
          },
        }),
      ),
  );
  signIn.mockRejectedValueOnce(new Error("simulated private provider failure"));
  render(<PasswordAddition githubAvailable />);
  fireEvent.click(screen.getByRole("button", { name: "GitHubで本人確認" }));
  await screen.findByText(
    "GitHubで本人確認を開始できませんでした。時間をおいて再試行してください。",
  );
  expect(document.body.textContent).not.toContain("private provider failure");
});
