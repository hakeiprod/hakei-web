"use client";
import { CardBody, Card, Input, Button, Checkbox } from "@heroui/react";

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
    <Card
      aria-label="取り込みプレビュー"
      as="section"
      className="min-w-0 overflow-visible border border-divider bg-content1"
    >
      <CardBody className="min-w-0 space-y-4 p-4 sm:p-6">
        <h2 className="text-xl font-semibold">
          {preview.metadata.sourceName ?? "楽譜"}のプレビュー
        </h2>
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
        <div className="min-w-0 max-w-full overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm [&_td]:min-w-28 [&_th]:bg-default-100 [&_th]:p-3 [&_th]:text-left [&_td]:border-b [&_td]:border-divider [&_td]:p-3">
            <caption className="text-left">
              音符の確認と修正（四分音符を1拍として表示）
            </caption>
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
                          <Input
                            aria-label={`${label}の${field === "pitch" ? "音高" : field === "start" ? "開始位置" : "長さ"}`}
                            type="number"
                            step={field === "pitch" ? 1 : "any"}
                            min={field === "duration" ? 0.000_001 : 0}
                            max={field === "pitch" ? 127 : undefined}
                            placeholder={original === null ? "不明" : undefined}
                            onChange={(event) =>
                              change(index, field, event.target.value)
                            }
                            value={
                              (edits[index]?.[field] ??
                                (typeof original === "number"
                                  ? original
                                  : "")) == null
                                ? ""
                                : String(
                                    edits[index]?.[field] ??
                                      (typeof original === "number"
                                        ? original
                                        : ""),
                                  )
                            }
                            variant="bordered"
                            labelPlacement="outside"
                            className="min-w-0"
                            isDisabled={
                              properties.pending ||
                              (field === "pitch" && note.rest)
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
        </div>
        <Button
          type="button"
          onClick={() => setPage((previous) => previous - 1)}
          isDisabled={page === 0 || properties.pending}
          color="default"
          variant="bordered"
          className="max-w-full whitespace-normal"
          isLoading={properties.pending}
        >
          前の音符
        </Button>
        <span>{page + 1}ページ</span>
        <Button
          type="button"
          onClick={() => setPage((previous) => previous + 1)}
          isDisabled={
            (page + 1) * 50 >= preview.candidate.notes.length ||
            properties.pending
          }
          color="default"
          variant="bordered"
          className="max-w-full whitespace-normal"
          isLoading={properties.pending}
        >
          次の音符
        </Button>
        <Button
          type="button"
          onClick={() => properties.onCorrect(Object.values(edits))}
          isDisabled={properties.pending || Object.keys(edits).length === 0}
          color="primary"
          variant="solid"
          className="max-w-full whitespace-normal"
          isLoading={properties.pending}
        >
          修正内容を再検証
        </Button>
        <h3 className="text-lg font-semibold">変換時の確認事項</h3>
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
                  <div className="min-w-0">
                    <Checkbox
                      onChange={(event) =>
                        setAcknowledged((previous) =>
                          event.target.checked
                            ? [...previous, issue.id]
                            : previous.filter((id) => id !== issue.id),
                        )
                      }
                      isSelected={acknowledged.includes(issue.id)}
                      isDisabled={properties.pending}
                    >
                      {"この内容を確認しました"}
                    </Checkbox>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          onClick={() => properties.onSave(acknowledged)}
          isDisabled={
            properties.pending ||
            required.some((issue) => !acknowledged.includes(issue.id)) ||
            Object.keys(edits).length > 0
          }
          color="primary"
          variant="solid"
          className="max-w-full whitespace-normal"
          isLoading={properties.pending}
        >
          確認した楽譜を保存
        </Button>
        <Button
          type="button"
          onClick={properties.onCancel}
          isDisabled={properties.saving}
          color="default"
          variant="light"
          className="max-w-full whitespace-normal"
        >
          取り込みを中止
        </Button>
      </CardBody>
    </Card>
  );
}
