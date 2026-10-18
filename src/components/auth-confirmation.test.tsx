import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AuthConfirmation } from "./auth-confirmation";
vi.mock("next-auth/react", () => ({ getSession: vi.fn(async () => null) }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  globalThis.history.replaceState(null, "", "/");
});
it("removes the fragment before accepting input and consumes only by explicit POST", async () => {
  const persisted = vi.spyOn(Storage.prototype, "setItem");
  globalThis.history.replaceState(
    null,
    "",
    `/auth/confirm#token=${"x".repeat(43)}&purpose=VERIFY`,
  );
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
    Response.json({
      ok: true,
      requestId: "test",
      data: { code: "REGISTERED", message: "登録が完了しました。" },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(
    <StrictMode>
      <AuthConfirmation />
    </StrictMode>,
  );
  await screen.findByLabelText("登録するパスワード");
  expect(globalThis.location.hash).toBe("");
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("登録するパスワード"), {
    target: { value: "owner-selected-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "登録を確定" }));
  await screen.findByText("登録が完了しました。");
  expect(fetcher.mock.calls[0][0]).toBe(
    "/api/account-auth/confirmRegistration",
  );
  expect(screen.getByRole("link", { name: "ログインする" })).toBeDefined();
  expect(persisted).not.toHaveBeenCalled();
});

it("rejects a missing fragment without posting or offering a password input", async () => {
  globalThis.history.replaceState(null, "", "/auth/confirm");
  const fetcher = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetcher);
  render(<AuthConfirmation />);
  expect(screen.queryByLabelText("登録するパスワード")).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
  expect(
    screen.getByRole("link", { name: "確認メールを再要求する" }),
  ).toBeDefined();
});

it("uses an explicit reset POST and offers login without authenticating automatically", async () => {
  globalThis.history.replaceState(
    null,
    "",
    `/auth/confirm#token=${"x".repeat(43)}&purpose=RESET`,
  );
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      ok: true,
      requestId: "test",
      data: { code: "PASSWORD_RESET", message: "再ログインしてください。" },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(
    <StrictMode>
      <AuthConfirmation />
    </StrictMode>,
  );
  expect(globalThis.location.hash).toBe("");
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("新しいパスワード"), {
    target: { value: "replacement-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "再設定を確定" }));
  await screen.findByText("再ログインしてください。");
  expect(fetcher.mock.calls[0][0]).toBe("/api/account-auth/resetPassword");
  expect(screen.queryByLabelText("新しいパスワード")).toBeNull();
});

it("confirms ADD only by POST on the current browser session", async () => {
  globalThis.history.replaceState(
    null,
    "",
    `/auth/confirm#token=${"x".repeat(43)}&purpose=ADD_PASSWORD`,
  );
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      ok: true,
      requestId: "test",
      data: { code: "PASSWORD_ADDED", message: "再ログインしてください。" },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<AuthConfirmation />);
  expect(globalThis.location.hash).toBe("");
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("新しいパスワード"), {
    target: { value: "owner-selected-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "追加を確定" }));
  await screen.findByText("再ログインしてください。");
  expect(fetcher.mock.calls[0][0]).toBe(
    "/api/account-auth/confirmPasswordAddition",
  );
});

for (const [purpose, destination] of [
  ["VERIFY", "/auth/register"],
  ["RESET", "/auth/reset"],
  ["ADD_PASSWORD", "/account/security"],
]) {
  it(`preserves the ${purpose} retry destination for an invalid token and after reload`, () => {
    history.replaceState(
      null,
      "",
      `/auth/confirm#token=invalid&purpose=${purpose}`,
    );
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    const view = render(<AuthConfirmation />);
    expect(
      screen
        .getByRole("link", { name: "確認メールを再要求する" })
        .getAttribute("href"),
    ).toBe(destination);
    expect(screen.queryByLabelText("新しいパスワード")).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    view.unmount();
    render(<AuthConfirmation />);
    expect(screen.queryByLabelText("登録するパスワード")).toBeNull();
    expect(screen.queryByLabelText("新しいパスワード")).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
}
