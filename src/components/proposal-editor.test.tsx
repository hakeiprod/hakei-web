import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import * as Core from "@/s-core/models/core";
const signals = vi.hoisted(() => ({
  save: vi.fn(),
  submit: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: signals.push, refresh: signals.refresh }),
}));
vi.mock("@/app/actions/proposals", () => ({
  saveDraft: signals.save,
  submitProposal: signals.submit,
}));
vi.mock("./show-score", () => ({ ShowScore: () => null }));
import { ProposalEditor } from "./proposal-editor";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
test("failed saves keep the edited pitch and summary; identical retries reuse the operation key", async () => {
  // The component receives persisted JSON, not live Beat instances.
  // eslint-disable-next-line unicorn/prefer-structured-clone
  const initial = JSON.parse(
    JSON.stringify(
      Core.Score.create({
        tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
      })
        .toSheet()
        .export(),
    ),
  );
  signals.save.mockResolvedValue({
    ok: false,
    error: { message: "Try again" },
  });
  render(
    <ProposalEditor
      repositoryId="repo"
      scoreId={1}
      baseRevisionId="revision"
      initial={initial}
    />,
  );
  const pitch = screen.getByLabelText(
    "トラック1・音符1の音高",
  ) as HTMLInputElement;
  fireEvent.change(pitch, { target: { value: "62" } });
  fireEvent.change(screen.getByLabelText("修正内容の説明"), {
    target: { value: "Correct note" },
  });
  fireEvent.click(screen.getByText("下書きを保存"));
  await waitFor(() => expect(signals.save).toHaveBeenCalledTimes(1));
  await screen.findByText("Try again");
  expect(pitch.value).toBe("62");
  fireEvent.click(screen.getByText("下書きを保存"));
  await waitFor(() => expect(signals.save).toHaveBeenCalledTimes(2));
  expect(signals.save.mock.calls[0][0].key).toBe(
    signals.save.mock.calls[1][0].key,
  );
  fireEvent.change(pitch, { target: { value: "64" } });
  fireEvent.click(screen.getByText("下書きを保存"));
  await waitFor(() => expect(signals.save).toHaveBeenCalledTimes(3));
  expect(signals.save.mock.calls[2][0].key).not.toBe(
    signals.save.mock.calls[0][0].key,
  );
  expect(
    (screen.getByLabelText("修正内容の説明") as HTMLTextAreaElement).value,
  ).toBe("Correct note");
});
