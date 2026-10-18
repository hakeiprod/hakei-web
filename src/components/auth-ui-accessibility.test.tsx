import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EmailRegistration } from "./email-registration";
import { AuthConfirmation } from "./auth-confirmation";
import { PasswordReset } from "./password-reset";
import { PasswordChange } from "./password-change";
import { PasswordAddition } from "./password-addition";
const session = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
  signIn: vi.fn(async () => {}),
}));
vi.mock("next-auth/react", () => session);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  history.replaceState(null, "", "/");
});
const cases = [
  {
    name: "registration",
    component: () => <EmailRegistration />,
    fields: [
      ["メールアドレス", "person@example.invalid"],
      ["パスワード", "valid-test-password"],
    ],
    button: "確認メールを送信",
  },
  {
    name: "confirmation",
    component: () => <AuthConfirmation />,
    fields: [["登録するパスワード", "valid-test-password"]],
    button: "登録を確定",
  },
  {
    name: "reset",
    component: () => <PasswordReset />,
    fields: [["メールアドレス", "person@example.invalid"]],
    button: "再設定メールを送信",
  },
  {
    name: "change",
    component: () => <PasswordChange />,
    fields: [
      ["現在のパスワード", "original-password"],
      ["新しいパスワード", "replacement-password"],
    ],
    button: "パスワードを変更",
  },
  {
    name: "addition",
    component: () => <PasswordAddition githubAvailable />,
    fields: [],
    button: "確認メールを送信",
  },
];
for (const scenario of cases) {
  it(`${scenario.name}: blocks duplicate submissions and aborts a pending request on unmount`, async () => {
    history.replaceState(
      null,
      "",
      `/auth/confirm#token=${"x".repeat(43)}&purpose=VERIFY`,
    );
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    const view = render(scenario.component());
    for (const [label, value] of scenario.fields) {
      const input = screen.getByLabelText(label) as HTMLInputElement;
      expect(input.required).toBe(true);
      expect(input.getAttribute("autocomplete")).toBe(
        label === "メールアドレス"
          ? "email"
          : label === "現在のパスワード"
            ? "current-password"
            : "new-password",
      );
      fireEvent.change(input, { target: { value } });
    }
    const button = screen.getByRole("button", { name: scenario.button });
    fireEvent.click(button);
    if (button.closest("form")) fireEvent.submit(button.closest("form")!);
    else fireEvent.click(button);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    const signal = fetcher.mock.calls[0][1]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      resolve(
        Response.json({
          ok: true,
          requestId: "test",
          data: { code: "ACCEPTED", message: "late result" },
        }),
      );
    });
    expect(screen.queryByText("late result")).toBeNull();
    expect(session.getSession).not.toHaveBeenCalled();
  });
  it(`${scenario.name}: reports safe failures politely and permits retry`, async () => {
    history.replaceState(
      null,
      "",
      `/auth/confirm#token=${"x".repeat(43)}&purpose=VERIFY`,
    );
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("private details"))
      .mockResolvedValue(
        Response.json({
          ok: false,
          requestId: "test",
          error: {
            code: "RATE_LIMITED",
            message: "しばらく待ってください。",
            retryable: true,
          },
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    render(scenario.component());
    for (const [label, value] of scenario.fields)
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: scenario.button }));
    const status = screen.getByRole("status");
    await vi.waitFor(() => expect(status.textContent).not.toBe(""));
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(document.body.textContent).not.toContain("private details");
    fireEvent.click(screen.getByRole("button", { name: scenario.button }));
    await screen.findByText("しばらく待ってください。");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
}
it("associates local password errors with the field and preserves autocomplete", () => {
  render(<EmailRegistration />);
  fireEvent.change(screen.getByLabelText("メールアドレス"), {
    target: { value: "person@example.invalid" },
  });
  const input = screen.getByLabelText("パスワード");
  fireEvent.change(input, { target: { value: "short" } });
  fireEvent.submit(input.closest("form")!);
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(input.getAttribute("autocomplete")).toBe("new-password");
  const references = [
    input.getAttribute("aria-describedby"),
    input.getAttribute("aria-errormessage"),
  ]
    .filter(Boolean)
    .join(" ")
    .split(/\s+/);
  expect(
    references.some((id) =>
      document.querySelector(`[id="${id}"]`)?.textContent?.includes("15〜128"),
    ),
  ).toBe(true);
});
