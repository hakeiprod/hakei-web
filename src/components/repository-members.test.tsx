import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
const signals = vi.hoisted(() => ({ member: vi.fn(), sharing: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/repositories", () => ({
  setMember: signals.member,
  updateRepository: signals.sharing,
}));
import { RepositoryMembers } from "./repository-members";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
test("preserves sharing defaults, member enum and checkbox on/absent serialization", async () => {
  signals.member.mockResolvedValue({ ok: true });
  signals.sharing.mockResolvedValue({ ok: true });
  render(
    <RepositoryMembers
      repositoryId="repo"
      accessVersion={7}
      visibility="PUBLIC"
      editScope="ALL_USERS"
      members={[]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "共有範囲を保存" }));
  await waitFor(() =>
    expect(signals.sharing).toHaveBeenCalledWith({
      repositoryId: "repo",
      visibility: "PUBLIC",
      editScope: "ALL_USERS",
      expectedAccessVersion: 7,
    }),
  );
  await screen.findByText("共有範囲を更新しました。");
  fireEvent.change(screen.getByLabelText("利用者ID"), {
    target: { value: "editor" },
  });
  const submit = screen.getByRole("button", {
    name: "メンバーを更新",
  }) as HTMLButtonElement;
  expect(new FormData(submit.form!).has("canMerge")).toBe(false);
  fireEvent.keyDown(screen.getByRole("button", { name: /役割/ }), {
    key: "ArrowDown",
  });
  fireEvent.click(await screen.findByRole("option", { name: "編集者" }));
  fireEvent.click(
    screen.getByRole("checkbox", { name: "編集者にマージを許可" }),
  );
  expect(new FormData(submit.form!).get("canMerge")).toBe("on");
  fireEvent.click(submit);
  await waitFor(() =>
    expect(signals.member).toHaveBeenCalledWith({
      repositoryId: "repo",
      userId: "editor",
      role: "EDITOR",
      canMerge: true,
      expectedAccessVersion: 7,
    }),
  );
});
