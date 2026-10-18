import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EmailRegistration } from "./email-registration";
import { AuthConfirmation } from "./auth-confirmation";
import { PasswordChange } from "./password-change";
vi.mock("next-auth/react", () => ({ getSession: vi.fn(async () => null) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  history.replaceState(null, "", "/");
});
for (const kind of ["register", "confirm", "change"]) {
  for (const [password, valid] of [
    ["音".repeat(14), false],
    ["🎵".repeat(15), true],
    ["🎵".repeat(128), true],
    ["音".repeat(129), false],
    ["a".repeat(14) + "\uD800", false],
    ["  " + "音".repeat(15) + "  ", true],
  ] as const) {
    it(`${kind}: preserves ${[...password].length} codepoints and validates without HTML truncation (${valid})`, async () => {
      history.replaceState(
        null,
        "",
        `/auth/confirm#token=${"x".repeat(43)}&purpose=VERIFY`,
      );
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          ok: true,
          requestId: "test",
          data: { code: "ACCEPTED", message: "完了しました。" },
        }),
      );
      vi.stubGlobal("fetch", fetcher);
      render(
        kind === "register" ? (
          <EmailRegistration />
        ) : kind === "confirm" ? (
          <AuthConfirmation />
        ) : (
          <PasswordChange />
        ),
      );
      if (kind === "register")
        fireEvent.change(screen.getByLabelText("メールアドレス"), {
          target: { value: "person@example.invalid" },
        });
      if (kind === "change")
        fireEvent.change(screen.getByLabelText("現在のパスワード"), {
          target: { value: "original-password" },
        });
      const input = screen.getByLabelText(
        kind === "register"
          ? "パスワード"
          : kind === "confirm"
            ? "登録するパスワード"
            : "新しいパスワード",
      );
      expect(input.hasAttribute("minlength")).toBe(false);
      expect(input.hasAttribute("maxlength")).toBe(false);
      fireEvent.change(input, { target: { value: password } });
      fireEvent.submit(input.closest("form")!);
      if (valid) {
        await screen.findByText("完了しました。");
        const body = JSON.parse(fetcher.mock.calls[0][1]?.body as string);
        expect(body[kind === "register" ? "password" : "newPassword"]).toBe(
          password,
        );
      } else {
        expect(fetcher).not.toHaveBeenCalled();
        expect(input.getAttribute("aria-invalid")).toBe("true");
      }
    });
  }
}
