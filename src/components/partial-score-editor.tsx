"use client";
import { CardBody, Card, Input, Button, Textarea } from "@heroui/react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { partialScoreSchema } from "@/s-core/models/import/contracts";
import { saveDraft, submitProposal } from "@/app/actions/proposals";
import { useMutationKey } from "./use-mutation-key";
export function PartialScoreEditor(properties: {
  repositoryId: string;
  scoreId: number;
  baseRevisionId: string;
  initial: unknown;
}) {
  const [candidate, setCandidate] = useState(() =>
    partialScoreSchema.parse(properties.initial),
  );
  const [summary, setSummary] = useState(""),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const [page, setPage] = useState(0);
  const router = useRouter(),
    keyFor = useMutationKey();
  return (
    <Card
      as="section"
      className="min-w-0 overflow-visible border border-divider bg-content1"
    >
      <CardBody className="min-w-0 space-y-4 p-4 sm:p-6">
        <p>
          確認できた音高・開始位置・長さを入力してください。不明な値は空欄のまま保存できます。変更は編集案として提出し、原本を直接変更しません。
        </p>
        <div className="min-w-0 max-w-full overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm [&_td]:min-w-28 [&_th]:bg-default-100 [&_th]:p-3 [&_th]:text-left [&_td]:border-b [&_td]:border-divider [&_td]:p-3">
            <caption className="text-left">
              欠落した音符の修正（四分音符=1拍）
            </caption>
            <thead>
              <tr>
                <th>音符</th>
                <th>音高</th>
                <th>開始（拍）</th>
                <th>長さ（拍）</th>
              </tr>
            </thead>
            <tbody>
              {candidate.notes
                .slice(page * 50, (page + 1) * 50)
                .map((note, offset) => {
                  const index = page * 50 + offset;
                  return (
                    <tr key={`${note.trackId}:${note.id}`}>
                      <th>
                        トラック{note.trackId + 1}・音符{index + 1}
                      </th>
                      {(["pitch", "onset", "duration"] as const).map(
                        (field) => (
                          <td key={field}>
                            <Input
                              aria-label={`音符${index + 1}の${field === "pitch" ? "音高" : field === "onset" ? "開始位置" : "長さ"}`}
                              type="number"
                              step={field === "pitch" ? 1 : "any"}
                              min={0}
                              max={field === "pitch" ? 127 : undefined}
                              placeholder="不明"
                              onChange={(event) => {
                                const value =
                                  event.target.value === ""
                                    ? null
                                    : Number(event.target.value);
                                setCandidate((previous) => ({
                                  ...previous,
                                  notes: previous.notes.map((note, current) =>
                                    current === index
                                      ? { ...note, [field]: value }
                                      : note,
                                  ),
                                }));
                              }}
                              value={
                                (note[field] ?? "") == null
                                  ? ""
                                  : String(note[field] ?? "")
                              }
                              variant="bordered"
                              labelPlacement="outside"
                              className="min-w-0"
                              isDisabled={
                                pending || (note.rest && field === "pitch")
                              }
                            />
                          </td>
                        ),
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <Button
          onClick={() => setPage((previous) => previous - 1)}
          isDisabled={page === 0 || pending}
          type="button"
          color="default"
          variant="bordered"
          className="max-w-full whitespace-normal"
          isLoading={pending}
        >
          前の音符
        </Button>
        <Button
          onClick={() => setPage((previous) => previous + 1)}
          isDisabled={(page + 1) * 50 >= candidate.notes.length || pending}
          type="button"
          color="default"
          variant="bordered"
          className="max-w-full whitespace-normal"
          isLoading={pending}
        >
          次の音符
        </Button>
        <div className="min-w-0">
          <Textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            isDisabled={pending}
            label="変更の説明"
            variant="bordered"
            labelPlacement="outside"
          />
        </div>
        <Button
          onClick={async () => {
            setPending(true);
            try {
              const payload = {
                scoreId: properties.scoreId,
                baseRevisionId: properties.baseRevisionId,
                candidate,
                summary,
              };
              const saved = await saveDraft({
                ...payload,
                key: keyFor(payload),
              });
              if (!saved.ok) {
                setMessage(saved.error.message);
                return;
              }
              const data = saved.data as {
                proposalId: string;
                version: number;
              };
              const submitted = await submitProposal({
                proposalId: data.proposalId,
                expectedVersion: data.version,
              });
              if (!submitted.ok) {
                setMessage(submitted.error.message);
                return;
              }
              router.push(
                `/repositories/${properties.repositoryId}/proposals/${data.proposalId}`,
              );
              router.refresh();
            } catch {
              setMessage("保存できませんでした。入力を保持しています。");
            } finally {
              setPending(false);
            }
          }}
          isDisabled={pending || summary.trim() === ""}
          type="button"
          color="primary"
          variant="solid"
          className="max-w-full whitespace-normal"
          isLoading={pending}
        >
          修正案を提出
        </Button>
        <p
          role="status"
          className="empty:hidden rounded-lg bg-default-100 p-3 text-sm text-foreground"
        >
          {message}
        </p>
      </CardBody>
    </Card>
  );
}
