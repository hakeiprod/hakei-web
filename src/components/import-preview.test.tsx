import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import sheet from "@/s-core/fixtures/import/quarter-sheet.json";
import type { ComponentProps } from "react";
import * as BrowserRender from "@/s-core/models/browser/render-score";
const { save, push, renderingProbe } = vi.hoisted(() => ({
  save: vi.fn(), push: vi.fn(), renderingProbe: { actual: false },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));
vi.mock("@/app/actions/score-import", () => ({ saveImport: save }));
vi.mock("next/font/local", () => ({
  default: () => ({ className: "bravura", style: { fontFamily: "Bravura" } }),
}));
vi.mock("./virtual-keyboard", () => ({ VirtualKeyboard: () => null }));
vi.mock("./score-mixier", () => ({ ScoreMixier: () => null }));
vi.mock("./show-score", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./show-score")>();
  return {
    ShowScore: (properties: ComponentProps<typeof actual.ShowScore>) => renderingProbe.actual
      ? <actual.ShowScore {...properties} />
      : <div data-testid="notation">{properties.canPlay ? "再生可能" : "再生不可"}</div>,
  };
});
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
  vi.restoreAllMocks();
  renderingProbe.actual = false;
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
  fireEvent.click(screen.getByRole("button", { name: /MIDIの時刻/ }));
  fireEvent.click(
    await screen.findByRole("option", { name: "音符の位置を整列" }),
  );
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

it("shows actual MusicXML version and supported versions", () => {
  const data = preview();
  data.metadata = {
    ...data.metadata,
    format: "MUSICXML",
    formatVersion: "3.1",
  };
  render(
    <ImportPreview
      preview={data}
      pending={false}
      onSave={vi.fn()}
      onCorrect={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  expect(screen.getByText("元のMusicXMLバージョン: 3.1")).toBeDefined();
  expect(screen.getByText(/MusicXML 2.0・3.0・3.1・4.0/)).toBeDefined();
});

it("warns about display omissions without blocking a playable preview", () => {
  const data = preview();
  data.issues[0] = {
    ...data.issues[0],
    code: "DISPLAY_INFORMATION_OMITTED",
    message: "和声記号を表示できません。",
    track: 0,
    bar: 1,
  };
  render(
    <ImportPreview
      preview={data}
      pending={false}
      onSave={vi.fn()}
      onCorrect={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  expect(screen.getByText(/和声記号を表示できません/)).toBeDefined();
  expect(screen.getByText(/小節2/)).toBeDefined();
  expect(screen.getByTestId("notation").textContent).toBe("再生可能");
  expect(screen.queryByText(/元のMusicXMLバージョン/)).toBeNull();
});

it("keeps the original MusicXML version, warning acknowledgement and candidate through preview and explicit save", async () => {
  const value = preview();
  value.metadata.format = "MUSICXML";
  value.metadata.formatVersion = "3.1";
  value.metadata.sourceName = "naitoobunaitsu-bitomario.mxl";
  const original = structuredClone(value),
    onSave = vi.fn().mockImplementation(async () => {});
  const view = render(
    <ImportPreview
      preview={value}
      pending={false}
      onSave={onSave}
      onCorrect={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  expect(
    screen.getByText(/naitoobunaitsu-bitomario.mxlのプレビュー/),
  ).toBeDefined();
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox"));
  view.rerender(
    <ImportPreview
      preview={value}
      pending={false}
      onSave={onSave}
      onCorrect={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "確認した楽譜を保存" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(["warning"]));
  expect(value).toEqual(original);
});

it("selects the required candidate schema without changing complete/partial validation or parsed payloads", async () => {
  const { parseImportPreview } = await import("./import-preview");
  const complete = preview();
  const partial = {
    ...complete,
    candidate: {
      format: "converted-partial-v1",
      tracks: [],
      notes: [],
      tempos: [],
      timesignatures: [],
      keysignatures: [],
    },
  };
  for (const input of [complete, partial])
    expect(parseImportPreview(input)).toEqual(importPreviewSchema.parse(input));
  const invalid = {
    ...complete,
    candidate: { ...sheet, notes: [{ ...sheet.notes[0], duration: -1 }] },
  };
  expect(() => parseImportPreview(invalid)).toThrow();
});

it.each([
  [false, "error"],
  [true, "error"],
  [false, "cancelled"],
  [true, "cancelled"],
] as const)(
  "real Viewer preserves warning acknowledgement and canPractice (blocking=%s, terminal=%s)",
  async (blocking, terminal) => {
    renderingProbe.actual = true;
    const data = preview(blocking);
    const original = structuredClone(data);
    let fail!: (reason: Error) => void;
    const draw = vi.spyOn(BrowserRender, "renderScore").mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const onSave = vi.fn();
    const onCorrect = vi.fn();
    render(
      <ImportPreview
        preview={data}
        pending={false}
        onSave={onSave}
        onCorrect={onCorrect}
        onCancel={vi.fn()}
      />,
    );
    await waitFor(() => expect(draw).toHaveBeenCalledOnce());
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    const saveButton = screen.getByRole("button", {
      name: "確認した楽譜を保存",
    }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
    fireEvent.click(checkbox);
    expect(saveButton.disabled).toBe(false);
    const permissionText = blocking
      ? /保存できますが、未解決/
      : "練習・ゲームに利用できます。";
    expect(screen.getByText(permissionText)).toBeDefined();
    if (terminal === "error") {
      await act(async () => fail(new Error("private render failure")));
      expect(screen.getByRole("alert").textContent).toContain(
        "楽譜を表示できませんでした",
      );
    } else {
      fireEvent.click(screen.getByRole("button", { name: "表示を取消" }));
      expect(draw.mock.calls[0][2]?.signal?.aborted).toBe(true);
      await act(async () => fail(new Error("late cancelled rendering")));
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getByText("表示を取り消しました。")).toBeDefined();
    }
    expect(checkbox.checked).toBe(true);
    expect(saveButton.disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    await waitFor(() =>
      expect(
        document.querySelector('[data-render-state="ready"] svg'),
      ).not.toBeNull(),
    );
    expect(draw.mock.calls[1][0]).toBe(draw.mock.calls[0][0]);
    expect(checkbox.checked).toBe(true);
    expect(saveButton.disabled).toBe(false);
    expect(screen.getByText(permissionText)).toBeDefined();
    expect(screen.queryByRole("button", { name: "再生" })).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
    expect(onCorrect).not.toHaveBeenCalled();
    expect(data).toEqual(original);
    fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalledWith(["warning"]);
  },
);

it.each(["cancel", "unmount", "pagehide"] as const)(
  "form %s aborts the real pending Viewer without saving or navigating",
  async (action) => {
    renderingProbe.actual = true;
    const data = preview();
    const original = structuredClone(data);
    const fetcher = vi.fn().mockResolvedValue(Response.json(data));
    vi.stubGlobal("fetch", fetcher);
    const draw = vi
      .spyOn(BrowserRender, "renderScore")
      .mockImplementation(() => new Promise(() => {}));
    const view = render(<FormCreateScore repositoryId="repo" />);
    fireEvent.change(screen.getByLabelText("楽譜ファイル（5MiB以内）"), {
      target: { files: [new File(["original"], "score.mid")] },
    });
    await waitFor(() => expect(draw).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("checkbox"));
    const signal = draw.mock.calls[0][2]?.signal;
    expect(signal?.aborted).toBe(false);
    expect(save).not.toHaveBeenCalled();
    switch (action) {
      case "cancel": {
        fireEvent.click(screen.getByRole("button", { name: "取り込みを中止" }));
        expect(screen.getByText("取り込みを中止しました。")).toBeDefined();
        break;
      }
      case "pagehide": {
        fireEvent(document.defaultView!, new Event("pagehide"));
        expect(
          screen.getByText("画面を離れたため元ファイルを解放しました。"),
        ).toBeDefined();
        break;
      }
      default: {
        view.unmount();
      }
    }
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByText("score.midのプレビュー")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(save).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(data).toEqual(original);
    expect(fetcher).toHaveBeenCalledOnce();
  },
);
