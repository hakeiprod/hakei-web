"use client";
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
    <section>
      <p>
        確認できた音高・開始位置・長さを入力してください。不明な値は空欄のまま保存できます。変更は編集案として提出し、原本を直接変更しません。
      </p>
      <table>
        <caption>欠落した音符の修正（四分音符=1拍）</caption>
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
                  {(["pitch", "onset", "duration"] as const).map((field) => (
                    <td key={field}>
                      <input
                        aria-label={`音符${index + 1}の${field === "pitch" ? "音高" : field === "onset" ? "開始位置" : "長さ"}`}
                        type="number"
                        step={field === "pitch" ? 1 : "any"}
                        min={0}
                        max={field === "pitch" ? 127 : undefined}
                        placeholder="不明"
                        disabled={pending || (note.rest && field === "pitch")}
                        value={note[field] ?? ""}
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
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
        </tbody>
      </table>
      <button
        disabled={page === 0 || pending}
        onClick={() => setPage((previous) => previous - 1)}
      >
        前の音符
      </button>
      <button
        disabled={(page + 1) * 50 >= candidate.notes.length || pending}
        onClick={() => setPage((previous) => previous + 1)}
      >
        次の音符
      </button>
      <label>
        変更の説明
        <textarea
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          disabled={pending}
        />
      </label>
      <button
        disabled={pending || summary.trim() === ""}
        onClick={async () => {
          setPending(true);
          try {
            const payload = {
              scoreId: properties.scoreId,
              baseRevisionId: properties.baseRevisionId,
              candidate,
              summary,
            };
            const saved = await saveDraft({ ...payload, key: keyFor(payload) });
            if (!saved.ok) {
              setMessage(saved.error.message);
              return;
            }
            const data = saved.data as { proposalId: string; version: number };
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
      >
        修正案を提出
      </button>
      <p role="status">{message}</p>
    </section>
  );
}
