import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
const signals = vi.hoisted(() => ({ create: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: signals.refresh }),
}));
vi.mock("@/app/actions/repositories", () => ({
  createRepository: signals.create,
}));
import { RepositoryCreate } from "./repository-create";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
test("preserves initial enum values, real option selection and a single submit payload", async () => {
  signals.create.mockResolvedValue({ ok: false, error: { message: "Retry" } });
  render(<RepositoryCreate />);
  const name = screen.getByLabelText("名前") as HTMLInputElement;
  expect(name.required).toBe(true);
  expect(name.maxLength).toBe(200);
  fireEvent.change(name, { target: { value: "Music" } });
  const button = screen.getByRole("button", {
    name: "作成",
  }) as HTMLButtonElement;
  expect(button.type).toBe("submit");
  const initial = new FormData(button.form!);
  expect(initial.get("visibility")).toBe("PRIVATE");
  expect(initial.get("editScope")).toBe("INVITED");
  fireEvent.keyDown(screen.getByRole("button", { name: /閲覧範囲/ }), {
    key: "ArrowDown",
  });
  fireEvent.click(await screen.findByRole("option", { name: "公開" }));
  fireEvent.click(button);
  await waitFor(() => expect(signals.create).toHaveBeenCalledTimes(1));
  expect(signals.create.mock.calls[0][0]).toMatchObject({
    name: "Music",
    visibility: "PUBLIC",
    editScope: "INVITED",
  });
  expect(signals.create.mock.calls[0][0]).not.toHaveProperty(
    "expectedAccessVersion",
  );
  await screen.findByText("Retry");
  expect(name.value).toBe("Music");
});
