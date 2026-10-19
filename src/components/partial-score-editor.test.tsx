import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
const signals = vi.hoisted(() => ({
  save: vi.fn(),
  submit: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: signals.push, refresh: vi.fn() }),
}));
vi.mock("@/app/actions/proposals", () => ({
  saveDraft: signals.save,
  submitProposal: signals.submit,
}));
import { PartialScoreEditor } from "./partial-score-editor";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
test("preserves null, zero, fractional beats, rests and stable IDs across fifty-row pages", async () => {
  signals.save.mockResolvedValue({
    ok: true,
    data: { proposalId: "proposal", version: 2 },
  });
  signals.submit.mockResolvedValue({ ok: true });
  const notes = Array.from({ length: 51 }, (_, index) => ({
    id: `note-${index}`,
    trackId: 0,
    pitch: index === 1 ? null : 60,
    onset: index,
    duration: 1,
    velocity: 80,
    rest: index === 1,
  }));
  render(
    <PartialScoreEditor
      repositoryId="repository"
      scoreId={1}
      baseRevisionId="revision"
      initial={{
        format: "converted-partial-v1",
        tracks: [{ id: 0, name: "Piano", preset: 0 }],
        notes,
        tempos: [],
        timesignatures: [],
        keysignatures: [],
      }}
    />,
  );
  expect(screen.queryByLabelText("音符51の音高")).toBeNull();
  expect(
    (screen.getByLabelText("音符2の音高") as HTMLInputElement).disabled,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText("音符1の音高"), {
    target: { value: "0" },
  });
  fireEvent.change(screen.getByLabelText("音符1の開始位置"), {
    target: { value: "0.125" },
  });
  fireEvent.change(screen.getByLabelText("音符1の長さ"), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "次の音符" }));
  expect(screen.queryByLabelText("音符1の音高")).toBeNull();
  expect(screen.getByLabelText("音符51の音高")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "前の音符" }));
  expect((screen.getByLabelText("音符1の音高") as HTMLInputElement).value).toBe(
    "0",
  );
  fireEvent.change(screen.getByLabelText("変更の説明"), {
    target: { value: "Correction" },
  });
  fireEvent.click(screen.getByRole("button", { name: "修正案を提出" }));
  await waitFor(() =>
    expect(signals.push).toHaveBeenCalledWith(
      "/repositories/repository/proposals/proposal",
    ),
  );
  expect(signals.save.mock.calls[0][0]).toMatchObject({
    scoreId: 1,
    baseRevisionId: "revision",
    summary: "Correction",
    candidate: {
      notes: [
        expect.objectContaining({
          id: "note-0",
          pitch: 0,
          onset: 0.125,
          duration: null,
        }),
        ...notes.slice(1),
      ],
    },
  });
  expect(signals.submit).toHaveBeenCalledWith({
    proposalId: "proposal",
    expectedVersion: 2,
  });
}, 15_000);
