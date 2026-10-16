import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
const signals = vi.hoisted(() => ({
  publish: vi.fn(),
  adjust: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: signals.refresh }),
}));
vi.mock("@/app/actions/trust", () => ({
  publishTrustRule: signals.publish,
  adjustTrust: signals.adjust,
}));
import { TrustAdmin } from "./trust-admin";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
test("an unset policy has no fixed values; activation waits for the confirmation screen", async () => {
  signals.publish.mockResolvedValue({
    ok: true,
    data: { ruleId: "rule", policyVersion: 1 },
  });
  render(<TrustAdmin rule={null} ruleId={null} policyVersion={0} />);
  const values: Record<string, number> = {
    初期スコア: 10,
    運営調整の重み: 2,
    実績の重み: 1,
    他者評価の重み: 1,
    採用加点: 1,
    却下加減点: -1,
    評価係数: 1,
    評価下限: -1,
    評価上限: 1,
    スコア下限: 0,
    スコア上限: 100,
    マージ基準: 50,
  };
  for (const [label, value] of Object.entries(values)) {
    const input = screen.getByLabelText(label) as HTMLInputElement;
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { value: String(value) } });
  }
  fireEvent.change(screen.getByLabelText("変更理由"), {
    target: { value: "Verified policy" },
  });
  fireEvent.click(screen.getByText("適用内容を確認"));
  expect(screen.getByText("適用内容の確認")).toBeDefined();
  expect(signals.publish).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("このルールを有効化"));
  await waitFor(() => expect(signals.publish).toHaveBeenCalledTimes(1));
  expect(signals.publish.mock.calls[0][0]).toMatchObject({
    expectedPolicyVersion: 0,
    reason: "Verified policy",
    rule: { initialScore: 10, wAdmin: 2, mergeThreshold: 50 },
  });
});
