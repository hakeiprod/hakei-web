import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PasswordReset } from "./password-reset";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("requests reset without disclosing whether an account exists", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      ok: true,
      requestId: "test",
      data: { code: "ACCEPTED", message: "受信メールを確認してください。" },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<PasswordReset />);
  fireEvent.change(screen.getByLabelText("メールアドレス"), {
    target: { value: "person@example.invalid" },
  });
  fireEvent.click(screen.getByRole("button", { name: "再設定メールを送信" }));
  await screen.findByText("受信メールを確認してください。");
  expect(fetcher.mock.calls[0][0]).toBe(
    "/api/account-auth/requestPasswordReset",
  );
});
