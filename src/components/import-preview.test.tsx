import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import sheet from "@/s-core/fixtures/import/quarter-sheet.json";
const { save, push } = vi.hoisted(() => ({ save: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));
vi.mock("@/app/actions/score-import", () => ({ saveImport: save }));
vi.mock("./show-score", () => ({
  ShowScore: ({ canPlay }: { canPlay: boolean }) => (
    <div data-testid="notation">{canPlay ? "再生可能" : "再生不可"}</div>
  ),
}));
import { ImportPreview, importPreviewSchema } from "./import-preview";
import { FormCreateScore } from "./form-create-score";
const preview = (blocking = false) =>
  importPreviewSchema.parse({
    candidate: sheet,
    issues: [
      {
        id: "warning",
        code: "DEFAULT_METER",
        severity: blocking ? "BLOCKING" : "WARNING",
        status: "UNRESOLVED",
        message: "拍子を確認してください。",
      },
    ],
    metadata: {
      format: "MIDI",
      formatVersion: "SMF-1.0",
      converterVersion: "v1",
      sourceName: "score.mid",
      options: { mode: "PRESERVE" },
    },
    validation: {
      validatorVersion: "v1",
      canPractice: !blocking,
      canGame: !blocking,
      unresolvedIssueIds: blocking ? ["warning"] : [],
    },
    previewToken: "preview-token",
  });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("requires warning confirmation and keeps BLOCKING playback disabled", () => {
  const onSave = vi.fn();
  render(
    <ImportPreview
      preview={preview(true)}
      pending={false}
      onSave={onSave}
      onCorrect={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  const button = screen.getByRole("button", {
    name: "確認した楽譜を保存",
  }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(screen.getByTestId("notation").textContent).toBe("再生不可");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(button);
  expect(onSave).toHaveBeenCalledWith(["warning"]);
  expect(screen.getByText(/未解決の箇所/)).toBeDefined();
});
it("retains converted edits and mutation key after failed saves and releases the file on success", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(preview()));
  vi.stubGlobal("fetch", fetcher);
  save
    .mockResolvedValueOnce({ ok: false, error: { message: "保存失敗" } })
    .mockResolvedValueOnce({ ok: true, data: { scoreId: 123 } });
  render(<FormCreateScore repositoryId="repo" />);
  const input = screen.getByLabelText(
    "楽譜ファイル（5MiB以内）",
  ) as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File(["original MIDI bytes"], "score.mid")] },
  });
  await screen.findByText("score.midのプレビュー");
  expect(input.value).toBe("");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "確認した楽譜を保存" }));
  await screen.findByText("保存失敗");
  expect(screen.getByText("score.midのプレビュー")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "確認した楽譜を保存" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/score/123"));
  expect(save.mock.calls[0][0].key).toBe(save.mock.calls[1][0].key);
  expect(screen.queryByText("選択した楽譜: score.mid")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "元ファイルから再変換" }),
  ).toBeNull();
});
it("reconverts the original file on option changes and aborts pending work on unmount", async () => {
  const requests: { file: FormDataEntryValue | null; signal: AbortSignal }[] =
    [];
  const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
    requests.push({
      file: (init.body as FormData).get("file"),
      signal: init.signal as AbortSignal,
    });
    return Response.json(preview());
  });
  vi.stubGlobal("fetch", fetcher);
  const view = render(<FormCreateScore repositoryId="repo" />);
  fireEvent.change(screen.getByLabelText("楽譜ファイル（5MiB以内）"), {
    target: { files: [new File(["original"], "score.mid")] },
  });
  await screen.findByText("score.midのプレビュー");
  fireEvent.change(screen.getByLabelText("MIDIの時刻"), {
    target: { value: "QUANTIZE" },
  });
  await waitFor(() => expect(requests.length).toBe(2));
  expect((requests[0].file as File).name).toBe("score.mid");
  expect((requests[1].file as File).name).toBe("score.mid");
  view.unmount();
  expect(requests[1].signal.aborted).toBe(true);
});
it("releases the selected file when the page enters the browser back-forward cache", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(preview())));
  render(<FormCreateScore repositoryId="repo" />);
  fireEvent.change(screen.getByLabelText("楽譜ファイル（5MiB以内）"), {
    target: { files: [new File(["original"], "score.mid")] },
  });
  await screen.findByText("score.midのプレビュー");
  fireEvent(document.defaultView!, new Event("pagehide"));
  expect(screen.queryByText("選択した楽譜: score.mid")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "元ファイルから再変換" }),
  ).toBeNull();
});
