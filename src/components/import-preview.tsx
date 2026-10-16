"use client";
import { useState } from "react";
import { z } from "zod";
import {
  importCandidateSchema,
  conversionIssueSchema,
  importMetadataSchema,
  revisionValidationSchema,
} from "@/s-core/models/import/contracts";
import { ShowScore } from "./show-score";
export const importPreviewSchema = z.object({
  candidate: importCandidateSchema,
  issues: z.array(conversionIssueSchema),
  metadata: importMetadataSchema,
  validation: revisionValidationSchema,
  previewToken: z.string(),
  changedNoteCount: z.int().nonnegative().optional(),
});
export type ImportPreviewData = z.infer<typeof importPreviewSchema>;
export type ImportNoteCorrection = {
  kind: "NOTE";
  index: number;
  pitch?: number;
  start?: number;
  duration?: number;
};
export function ImportPreview(properties: {
  preview: ImportPreviewData;
  pending: boolean;
  saving?: boolean;
  onSave: (acknowledgedIssueIds: string[]) => Promise<void>;
  onCorrect: (corrections: ImportNoteCorrection[]) => Promise<void>;
  onCancel: () => void;
}) {
  const { preview } = properties;
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [edits, setEdits] = useState<Record<number, ImportNoteCorrection>>({});
  const [page, setPage] = useState(0);
  const required = preview.issues.filter(
    (issue) => issue.severity !== "INFO" && issue.status === "UNRESOLVED",
  );
  const partial =
    "format" in preview.candidate &&
    preview.candidate.format === "converted-partial-v1";
  const notes = preview.candidate.notes.slice(page * 50, (page + 1) * 50);
  function change(
    index: number,
    field: "pitch" | "start" | "duration",
    value: string,
  ) {
    if (value === "") return;
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    setEdits((previous) => ({
      ...previous,
      [index]: { ...previous[index], kind: "NOTE", index, [field]: number },
    }));
  }
  return (
    <section aria-label="取り込みプレビュー">
      <h2>{preview.metadata.sourceName ?? "楽譜"}のプレビュー</h2>
      <p>
        対応形式: MusicXML 4.0（XML・MXL）、MIDI（SMF
        0・1）、楽譜JSON。PDF・画像には対応していません。
      </p>
      {preview.changedNoteCount !== undefined && (
        <p>整列で変更した音符: {preview.changedNoteCount}個</p>
      )}
      <p>
        {preview.validation.canPractice
          ? "練習・ゲームに利用できます。"
          : "保存できますが、未解決の箇所があるため練習・ゲームには利用できません。"}
      </p>
      {!partial && (
        <ShowScore
          score={{ data: preview.candidate }}
          canPlay={preview.validation.canPractice}
        />
      )}
      {partial && (
        <p>
          不明な音高・開始位置・長さを「不明」として残しています。確認できた値を入力してください。
        </p>
      )}
      <table>
        <caption>音符の確認と修正（四分音符を1拍として表示）</caption>
        <thead>
          <tr>
            <th>トラック・音符</th>
            <th>音高（MIDI番号0〜127）</th>
            <th>開始（拍）</th>
            <th>長さ（拍）</th>
          </tr>
        </thead>
        <tbody>
          {notes.map((note, offset) => {
            const index = page * 50 + offset;
            const start = "start" in note ? note.start : note.onset;
            const label = `トラック${note.trackId + 1}・音符${index + 1}`;
            return (
              <tr key={`${note.trackId}:${note.id}`}>
                <th>
                  {label}
                  {note.rest ? "（休符）" : ""}
                </th>
                {(["pitch", "start", "duration"] as const).map((field) => {
                  const original = field === "start" ? start : note[field];
                  return (
                    <td key={field}>
                      <input
                        aria-label={`${label}の${field === "pitch" ? "音高" : field === "start" ? "開始位置" : "長さ"}`}
                        type="number"
                        step={field === "pitch" ? 1 : "any"}
                        min={field === "duration" ? 0.000_001 : 0}
                        max={field === "pitch" ? 127 : undefined}
                        disabled={
                          properties.pending || (field === "pitch" && note.rest)
                        }
                        placeholder={original === null ? "不明" : undefined}
                        value={
                          edits[index]?.[field] ??
                          (typeof original === "number" ? original : "")
                        }
                        onChange={(event) =>
                          change(index, field, event.target.value)
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <button
        type="button"
        disabled={page === 0 || properties.pending}
        onClick={() => setPage((previous) => previous - 1)}
      >
        前の音符
      </button>
      <span>{page + 1}ページ</span>
      <button
        type="button"
        disabled={
          (page + 1) * 50 >= preview.candidate.notes.length ||
          properties.pending
        }
        onClick={() => setPage((previous) => previous + 1)}
      >
        次の音符
      </button>
      <button
        type="button"
        disabled={properties.pending || Object.keys(edits).length === 0}
        onClick={() => properties.onCorrect(Object.values(edits))}
      >
        修正内容を再検証
      </button>
      <h3>変換時の確認事項</h3>
      {preview.issues.length === 0 ? (
        <p>確認事項はありません。</p>
      ) : (
        <ul>
          {preview.issues.map((issue) => (
            <li key={issue.id}>
              {issue.status === "RESOLVED"
                ? "修正済み"
                : issue.severity === "BLOCKING"
                  ? "演奏に使えない箇所"
                  : issue.severity === "WARNING"
                    ? "要確認"
                    : "補足"}
              : {issue.message}
              {issue.track === undefined
                ? ""
                : `（トラック${issue.track + 1}）`}
              {issue.bar === undefined ? "" : `（小節${issue.bar + 1}）`}
              {required.some((item) => item.id === issue.id) && (
                <label>
                  <input
                    type="checkbox"
                    checked={acknowledged.includes(issue.id)}
                    disabled={properties.pending}
                    onChange={(event) =>
                      setAcknowledged((previous) =>
                        event.target.checked
                          ? [...previous, issue.id]
                          : previous.filter((id) => id !== issue.id),
                      )
                    }
                  />
                  この内容を確認しました
                </label>
              )}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled={
          properties.pending ||
          required.some((issue) => !acknowledged.includes(issue.id)) ||
          Object.keys(edits).length > 0
        }
        onClick={() => properties.onSave(acknowledged)}
      >
        確認した楽譜を保存
      </button>
      <button
        type="button"
        disabled={properties.saving}
        onClick={properties.onCancel}
      >
        取り込みを中止
      </button>
    </section>
  );
}
