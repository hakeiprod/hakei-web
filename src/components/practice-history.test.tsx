import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ remove: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/actions/practice-history", () => ({
  deletePractice: mocks.remove,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
import { PracticeHistory } from "./practice-history";
const entry = {
  id: "s",
  status: "COMPLETED",
  startedAt: "2026-10-14T00:00:00.000Z",
  scoreId: 1,
  revisionId: "r",
  revisionNumber: 2,
  comparisonKey: "key",
  conditions: {
    trackId: 0,
    rangeStartBar: 1,
    rangeEndBar: 2,
    tempoScale: 1,
    calibrationUs: 0,
    mode: "PRACTICE",
    ruleVersion: 1,
  },
  summary: { pitchAccuracy: 1, meanAbsTimingUs: 0 },
  score: null,
  canReadScore: false,
  isBest: true,
  achievements: ["FIRST_COMPLETION"],
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("shows private summaries, conditions, best and interrupted status", () => {
  render(
    <PracticeHistory
      history={{
        items: [
          entry,
          {
            ...entry,
            id: "i",
            status: "INTERRUPTED",
            isBest: false,
            achievements: [],
          },
        ],
        nextCursor: null,
        completedCount: 1,
      }}
    />,
  );
  expect(screen.getByText("完了回数: 1")).toBeDefined();
  expect(screen.getByText("自己ベスト")).toBeDefined();
  expect(screen.getByText(/中断（完了数に含めません）/)).toBeDefined();
  expect(screen.getAllByText(/楽譜本文は現在閲覧できません/)).toHaveLength(2);
});
it("asks explicitly before deletion and preserves the same key on retry", async () => {
  mocks.remove.mockResolvedValue({ ok: false, error: { message: "保存失敗" } });
  render(
    <PracticeHistory
      history={{ items: [entry], nextCursor: null, completedCount: 1 }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "記録を削除" }));
  expect(mocks.remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "入力と結果を削除する" }));
  await screen.findByText("保存失敗");
  fireEvent.click(screen.getByRole("button", { name: "入力と結果を削除する" }));
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(2));
  expect(mocks.remove.mock.calls[0]).toEqual(mocks.remove.mock.calls[1]);
});
