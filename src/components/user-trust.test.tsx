import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
const signals = vi.hoisted(() => ({ read: vi.fn(), review: vi.fn() }));
vi.mock("@/app/actions/trust", () => ({
  readTrust: signals.read,
  reviewUser: signals.review,
}));
import { UserTrust } from "./user-trust";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
test("preserves required target, decimal precision and input after a failed review", async () => {
  signals.read.mockResolvedValue({
    ok: false,
    error: { message: "No policy" },
  });
  signals.review.mockResolvedValue({ ok: false, error: { message: "Retry" } });
  render(<UserTrust userId="owner" />);
  await screen.findByText("No policy");
  fireEvent.change(screen.getByLabelText("利用者ID"), {
    target: { value: "other" },
  });
  const value = screen.getByLabelText("評価値") as HTMLInputElement;
  expect(value.required).toBe(true);
  expect(value.step).toBe("any");
  fireEvent.change(value, { target: { value: "-0.125" } });
  fireEvent.click(screen.getByRole("button", { name: "評価を保存" }));
  await waitFor(() =>
    expect(signals.review).toHaveBeenCalledWith({
      targetId: "other",
      value: -0.125,
    }),
  );
  await screen.findByText("Retry");
  expect(value.value).toBe("-0.125");
});
