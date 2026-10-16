import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PasswordChange } from "./password-change";
vi.mock("next-auth/react", () => ({ getSession: vi.fn(async () => null) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("ends the password form and requires normal login after a successful change", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        ok: true,
        requestId: "test",
        data: {
          code: "PASSWORD_CHANGED",
          message: "再ログインしてください。",
        },
      }),
    ),
  );
  render(<PasswordChange />);
  fireEvent.change(screen.getByLabelText("現在のパスワード"), {
    target: { value: "original-password" },
  });
  fireEvent.change(screen.getByLabelText("新しいパスワード"), {
    target: { value: "replacement-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "パスワードを変更" }));
  await screen.findByText("再ログインしてください。");
  expect(screen.queryByLabelText("現在のパスワード")).toBeNull();
  expect(screen.getByRole("link", { name: "ログインする" })).toBeDefined();
});
