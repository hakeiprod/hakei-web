import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EmailRegistration } from "./email-registration";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("requests confirmation without automatic login and offers resend", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
    Response.json({
      ok: true,
      requestId: "test",
      data: { code: "ACCEPTED", message: "確認メールを確認してください。" },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<EmailRegistration />);
  fireEvent.change(screen.getByLabelText("メールアドレス"), {
    target: { value: "player@example.invalid" },
  });
  fireEvent.change(screen.getByLabelText("パスワード"), {
    target: { value: "valid-test-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "確認メールを送信" }));
  await screen.findByText("確認メールを確認してください。");
  expect(fetcher.mock.calls[0][0]).toBe(
    "/api/account-auth/requestRegistration",
  );
  expect(
    screen.getByRole("button", { name: "確認メールを再送" }),
  ).toBeDefined();
  expect(screen.queryByRole("button", { name: "GitHubでログイン" })).toBeNull();
});
