"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveImport } from "@/app/actions/score-import";
import {
  midiConversionOptionsSchema,
  type MidiConversionOptions,
} from "@/s-core/models/import/quantize-midi";
import {
  ImportPreview,
  importPreviewSchema,
  type ImportPreviewData,
  type ImportNoteCorrection,
} from "./import-preview";
import { useMutationKey } from "./use-mutation-key";
export function FormCreateScore(properties: {
  repositoryId: string;
  scoreId?: number;
  baseRevisionId?: string;
}) {
  const router = useRouter(),
    keyFor = useMutationKey();
  const original = useRef<File | null>(null),
    active = useRef<AbortController | null>(null),
    mounted = useRef(true);
  const [preview, setPreview] = useState<ImportPreviewData>(),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const [options, setOptions] = useState<MidiConversionOptions>({
    mode: "PRESERVE",
  });
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    mounted.current = true;
    const browser = document.defaultView;
    const release = () => {
      active.current?.abort();
      original.current = null;
      setPreview(undefined);
      setFileName("");
      setPending(false);
      setMessage("画面を離れたため元ファイルを解放しました。");
    };
    browser?.addEventListener("pagehide", release);
    return () => {
      mounted.current = false;
      browser?.removeEventListener("pagehide", release);
      active.current?.abort();
      original.current = null;
    };
  }, []);
  function clear() {
    active.current?.abort();
    active.current = null;
    original.current = null;
    setPreview(undefined);
    setFileName("");
    setPending(false);
    setMessage("取り込みを中止しました。");
  }
  async function convert(file: File, nextOptions: MidiConversionOptions) {
    active.current?.abort();
    const abort = new AbortController();
    active.current = abort;
    setPending(true);
    setMessage("楽譜を変換しています…");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("options", JSON.stringify(nextOptions));
      const response = await fetch("/api/score-import/preview", {
        method: "POST",
        body: form,
        signal: abort.signal,
      });
      const data = await response.json();
      if (abort.signal.aborted || !mounted.current) return;
      if (!response.ok) {
        setMessage(data.error?.message ?? "変換できませんでした。");
        return;
      }
      setPreview(importPreviewSchema.parse(data));
      setMessage("プレビューと確認事項を確認してください。");
    } catch {
      if (!abort.signal.aborted && mounted.current)
        setMessage(
          "変換できませんでした。ファイルを保持しています。再試行できます。",
        );
    } finally {
      if (!abort.signal.aborted && mounted.current) setPending(false);
    }
  }
  async function correct(corrections: ImportNoteCorrection[]) {
    if (!preview) return;
    active.current?.abort();
    const abort = new AbortController();
    active.current = abort;
    setPending(true);
    try {
      const response = await fetch("/api/score-import/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalCandidate: preview.candidate,
          originalIssues: preview.issues,
          metadata: preview.metadata,
          previewToken: preview.previewToken,
          corrections,
        }),
        signal: abort.signal,
      });
      const data = await response.json();
      if (abort.signal.aborted || !mounted.current) return;
      if (!response.ok) {
        setMessage(data.error?.message ?? "修正を検証できませんでした。");
        return;
      }
      setPreview(importPreviewSchema.parse(data));
      setMessage("修正を再検証しました。確認事項を改めて確認してください。");
    } catch {
      if (!abort.signal.aborted && mounted.current)
        setMessage("修正を検証できませんでした。入力を保持しています。");
    } finally {
      if (!abort.signal.aborted && mounted.current) setPending(false);
    }
  }
  return (
    <section>
      <label>
        楽譜ファイル（5MiB以内）
        <input
          type="file"
          accept=".musicxml,.xml,.mxl,.mid,.midi,.json"
          disabled={pending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
              setMessage("楽譜ファイルは5MiB以内にしてください。");
              return;
            }
            original.current = file;
            setFileName(file.name);
            setPreview(undefined);
            setOptions({ mode: "PRESERVE" });
            convert(file, { mode: "PRESERVE" });
          }}
        />
      </label>
      {fileName && <p>選択した楽譜: {fileName}</p>}
      {/\.(mid|midi)$/i.test(fileName) && (
        <>
          <label>
            MIDIの時刻
            <select
              aria-label="MIDIの時刻"
              value={options.mode}
              disabled={pending}
              onChange={(event) => {
                const next: MidiConversionOptions =
                  event.target.value === "QUANTIZE"
                    ? { mode: "QUANTIZE", grid: "1/4" }
                    : { mode: "PRESERVE" };
                setOptions(next);
                if (original.current) convert(original.current, next);
              }}
            >
              <option value="PRESERVE">元の時刻を保持</option>
              <option value="QUANTIZE">音符の位置を整列</option>
            </select>
          </label>
          {options.mode === "QUANTIZE" && (
            <label>
              整列の単位
              <select
                aria-label="整列の単位"
                value={options.grid}
                disabled={pending}
                onChange={(event) => {
                  const next = midiConversionOptionsSchema.parse({
                    mode: "QUANTIZE",
                    grid: event.target.value,
                  });
                  setOptions(next);
                  if (original.current) convert(original.current, next);
                }}
              >
                {[
                  ["1/1", "四分音符"],
                  ["1/2", "八分音符"],
                  ["1/4", "十六分音符"],
                  ["1/8", "三十二分音符"],
                  ["1/3", "八分三連"],
                  ["1/6", "十六分三連"],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
      {fileName && !pending && (
        <button
          type="button"
          onClick={() => {
            if (original.current) convert(original.current, options);
          }}
        >
          元ファイルから再変換
        </button>
      )}
      {preview && (
        <ImportPreview
          key={preview.previewToken}
          preview={preview}
          pending={
            pending ||
            JSON.stringify(options) !== JSON.stringify(preview.metadata.options)
          }
          onCorrect={correct}
          onCancel={clear}
          saving={saving}
          onSave={async (acknowledgedIssueIds) => {
            setPending(true);
            setSaving(true);
            try {
              const payload = {
                repositoryId: properties.repositoryId,
                ...(properties.scoreId
                  ? {
                      scoreId: properties.scoreId,
                      baseRevisionId: properties.baseRevisionId,
                    }
                  : {}),
                candidate: preview.candidate,
                issues: preview.issues,
                metadata: preview.metadata,
                previewToken: preview.previewToken,
                acknowledgedIssueIds: [...acknowledgedIssueIds].toSorted(),
              };
              const result = await saveImport({
                ...payload,
                key: keyFor(payload),
              });
              if (!mounted.current) return;
              if (!result.ok) {
                setMessage(result.error.message);
                return;
              }
              original.current = null;
              active.current?.abort();
              setPreview(undefined);
              setFileName("");
              const data = result.data as {
                scoreId?: number;
                proposalId?: string;
              };
              router.push(
                data.proposalId
                  ? `/repositories/${properties.repositoryId}/proposals/${data.proposalId}`
                  : `/score/${data.scoreId}`,
              );
              router.refresh();
            } catch {
              if (mounted.current)
                setMessage(
                  "保存できませんでした。変換結果を保持しています。同じ内容で再試行できます。",
                );
            } finally {
              if (mounted.current) {
                setPending(false);
                setSaving(false);
              }
            }
          }}
        />
      )}
      {pending && !preview && (
        <button type="button" onClick={clear}>
          変換を中止
        </button>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
