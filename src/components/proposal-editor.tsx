"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDraft, submitProposal } from "@/app/actions/proposals";
import { sheetScoreSchema } from "@/s-core/models/import/score-schema";
import { ShowScore } from "./show-score";
import { useMutationKey } from "./use-mutation-key";
export function ProposalEditor(properties: {
  repositoryId: string;
  scoreId: number;
  baseRevisionId: string;
  initial: unknown;
  proposalId?: string;
  expectedVersion?: number;
  summary?: string;
}) {
  const router = useRouter();
  const keyFor = useMutationKey();
  const [candidate, setCandidate] = useState(() =>
    sheetScoreSchema.parse(properties.initial),
  );
  const [summary, setSummary] = useState(properties.summary ?? "");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  type Note = (typeof candidate.notes)[number];
  function updateNote(index: number, change: Partial<Note>) {
    setCandidate((previous) => ({
      ...previous,
      notes: previous.notes.map((note, current) => {
        if (current !== index) return note;
        const updated = { ...note, ...change };
        return { ...updated, end: updated.start + updated.duration };
      }),
    }));
  }
  async function save(submit: boolean) {
    setPending(true);
    try {
      const payload = {
        scoreId: properties.scoreId,
        baseRevisionId: properties.baseRevisionId,
        candidate,
        summary,
        ...(properties.proposalId
          ? {
              proposalId: properties.proposalId,
              expectedVersion: properties.expectedVersion,
            }
          : {}),
      };
      const result = await saveDraft({ ...payload, key: keyFor(payload) });
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      const saved = result.data as { proposalId: string; version: number };
      if (submit) {
        const submitted = await submitProposal({
          proposalId: saved.proposalId,
          expectedVersion: saved.version,
        });
        if (!submitted.ok) {
          setMessage(submitted.error.message);
          return;
        }
      }
      router.push(
        `/repositories/${properties.repositoryId}/proposals/${saved.proposalId}`,
      );
      router.refresh();
    } catch {
      setMessage(
        "保存できませんでした。下書きを保持しているので再試行できます。",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section>
      <h2>編集案</h2>
      <p>原本は提出やマージまで変更されません。</p>
      <label>
        修正内容の説明
        <textarea
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          required
          maxLength={2000}
        />
      </label>
      <table>
        <caption>音符と休符</caption>
        <thead>
          <tr>
            <th>音符</th>
            <th>音高</th>
            <th>開始位置（拍）</th>
            <th>長さ（拍）</th>
            <th>休符</th>
          </tr>
        </thead>
        <tbody>
          {candidate.notes.map((note, index) => (
            <tr key={`${note.trackId}:${note.id}`}>
              <td>{note.id + 1}</td>
              <td>
                <input
                  aria-label={`トラック${note.trackId + 1}・音符${note.id + 1}の音高`}
                  type="number"
                  min={0}
                  max={127}
                  value={note.pitch}
                  onChange={(event) =>
                    updateNote(index, { pitch: Number(event.target.value) })
                  }
                />
              </td>
              <td>
                <input
                  aria-label={`トラック${note.trackId + 1}・音符${note.id + 1}の開始位置`}
                  type="number"
                  min={0}
                  step="any"
                  value={note.start}
                  onChange={(event) =>
                    updateNote(index, { start: Number(event.target.value) })
                  }
                />
              </td>
              <td>
                <input
                  aria-label={`トラック${note.trackId + 1}・音符${note.id + 1}の長さ`}
                  type="number"
                  min={0.000_001}
                  step="any"
                  value={note.duration}
                  onChange={(event) =>
                    updateNote(index, { duration: Number(event.target.value) })
                  }
                />
              </td>
              <td>
                <input
                  aria-label={`トラック${note.trackId + 1}・音符${note.id + 1}を休符にする`}
                  type="checkbox"
                  checked={note.rest}
                  onChange={(event) =>
                    updateNote(index, { rest: event.target.checked })
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <fieldset>
        <legend>拍子</legend>
        {candidate.timesignatures.map((time, index) => (
          <div key={index}>
            <label>
              拍子 {index + 1} の分子
              <input
                type="number"
                min={1}
                value={time.numerator}
                onChange={(event) =>
                  setCandidate((previous) => ({
                    ...previous,
                    timesignatures: previous.timesignatures.map(
                      (item, current) =>
                        current === index
                          ? { ...item, numerator: Number(event.target.value) }
                          : item,
                    ),
                  }))
                }
              />
            </label>
            <label>
              分母
              <input
                type="number"
                min={1}
                value={time.denominator}
                onChange={(event) =>
                  setCandidate((previous) => ({
                    ...previous,
                    timesignatures: previous.timesignatures.map(
                      (item, current) =>
                        current === index
                          ? { ...item, denominator: Number(event.target.value) }
                          : item,
                    ),
                  }))
                }
              />
            </label>
          </div>
        ))}
      </fieldset>
      <fieldset>
        <legend>調号</legend>
        {candidate.keysignatures.map((key, index) => (
          <div key={index}>
            <label>
              調号 {index + 1} の変化数
              <input
                type="number"
                min={-7}
                max={7}
                value={key.accidental}
                onChange={(event) =>
                  setCandidate((previous) => ({
                    ...previous,
                    keysignatures: previous.keysignatures.map(
                      (item, current) =>
                        current === index
                          ? { ...item, accidental: Number(event.target.value) }
                          : item,
                    ),
                  }))
                }
              />
            </label>
            <label>
              長調・短調
              <select
                value={key.tonality}
                onChange={(event) =>
                  setCandidate((previous) => ({
                    ...previous,
                    keysignatures: previous.keysignatures.map(
                      (item, current) =>
                        current === index
                          ? {
                              ...item,
                              tonality: Number(event.target.value) as 0 | 1,
                            }
                          : item,
                    ),
                  }))
                }
              >
                <option value={0}>長調</option>
                <option value={1}>短調</option>
              </select>
            </label>
          </div>
        ))}
      </fieldset>
      <fieldset>
        <legend>テンポ</legend>
        {candidate.tempos.map((tempo, index) => (
          <label key={index}>
            テンポ {index + 1}（BPM）
            <input
              type="number"
              min={1}
              value={tempo.value}
              onChange={(event) =>
                setCandidate((previous) => ({
                  ...previous,
                  tempos: previous.tempos.map((item, current) =>
                    current === index
                      ? { ...item, value: Number(event.target.value) }
                      : item,
                  ),
                }))
              }
            />
          </label>
        ))}
      </fieldset>
      <h3>プレビュー</h3>
      <ShowScore score={{ data: candidate }} />
      <button disabled={pending || !summary.trim()} onClick={() => save(false)}>
        下書きを保存
      </button>
      <button disabled={pending || !summary.trim()} onClick={() => save(true)}>
        編集案を提出
      </button>
      <p role="status">{message}</p>
      <button onClick={() => router.refresh()}>最新の状態を確認</button>
    </section>
  );
}
