import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
const signals = vi.hoisted(() => ({ close: vi.fn(), merge: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/proposals", () => ({
  closeProposal: signals.close,
  mergeProposal: signals.merge,
}));
import { ProposalActions } from "./proposal-actions";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
test("retains reason, expected version and identical retry key without granting merge", async () => {
  signals.close.mockResolvedValue({ ok: false, error: { message: "Retry" } });
  render(
    <ProposalActions
      proposalId="proposal"
      version={3}
      baseRevisionId="revision"
      baseRepositoryCommitOid="commit"
      status="SUBMITTED"
      canMerge={false}
      mergeReason="No permission"
      canWithdraw={true}
    />,
  );
  expect(
    (screen.getByRole("button", { name: "マージ" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText("却下・取り下げの理由"), {
    target: { value: "Correction" },
  });
  fireEvent.click(screen.getByRole("button", { name: "取り下げ" }));
  await screen.findByText("Retry");
  fireEvent.click(screen.getByRole("button", { name: "取り下げ" }));
  await waitFor(() => expect(signals.close).toHaveBeenCalledTimes(2));
  expect(signals.close.mock.calls[0][0]).toEqual(
    signals.close.mock.calls[1][0],
  );
  expect(signals.close.mock.calls[0][0]).toMatchObject({
    proposalId: "proposal",
    expectedVersion: 3,
    decision: "WITHDRAWN",
    reason: "Correction",
  });
  expect(signals.merge).not.toHaveBeenCalled();
});
