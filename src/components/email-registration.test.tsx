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

it("resends with only the mailbox after clearing the submitted password", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
    Response.json({
      ok: true,
      requestId: "test",
      data: { code: "ACCEPTED", message: "受信メールを確認してください。" },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<EmailRegistration />);
  fireEvent.change(screen.getByLabelText("メールアドレス"), {
    target: { value: "person@example.invalid" },
  });
  fireEvent.change(screen.getByLabelText("パスワード"), {
    target: { value: "valid-test-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "確認メールを送信" }));
  const resend = await screen.findByRole("button", {
    name: "確認メールを再送",
  });
  expect((screen.getByLabelText("パスワード") as HTMLInputElement).value).toBe(
    "",
  );
  expect(
    screen.getByLabelText("パスワード").getAttribute("aria-invalid"),
  ).not.toBe("true");
  fireEvent.click(resend);
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(fetcher.mock.calls[1][0]).toBe("/api/account-auth/resendConfirmation");
  expect(JSON.parse(fetcher.mock.calls[1][1]?.body as string)).toEqual({
    email: "person@example.invalid",
  });
});

it("associates an invalid resend mailbox with its input without requiring another password", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      ok: true,
      requestId: "test",
      data: { code: "ACCEPTED", message: "受信メールを確認してください。" },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<EmailRegistration />);
  const email = screen.getByLabelText("メールアドレス");
  fireEvent.change(email, { target: { value: "person@example.invalid" } });
  fireEvent.change(screen.getByLabelText("パスワード"), {
    target: { value: "valid-test-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "確認メールを送信" }));
  const resend = await screen.findByRole("button", {
    name: "確認メールを再送",
  });
  fireEvent.change(email, { target: { value: "invalid" } });
  fireEvent.click(resend);
  expect(email.getAttribute("aria-invalid")).toBe("true");
  expect(
    screen.getByLabelText("パスワード").getAttribute("aria-invalid"),
  ).not.toBe("true");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
