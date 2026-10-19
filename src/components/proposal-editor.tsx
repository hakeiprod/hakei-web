"use client";
import {
  CardBody,
  Card,
  Textarea,
  Input,
  Checkbox,
  SelectItem,
  Select,
  Button,
} from "@heroui/react";

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
      const saved = result.data as {
        proposalId: string;
        version: number;
      };
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
    <Card
      as="section"
      className="min-w-0 overflow-visible border border-divider bg-content1"
    >
      <CardBody className="min-w-0 space-y-4 p-4 sm:p-6">
        <h2 className="text-xl font-semibold">編集案</h2>
        <p>原本は提出やマージまで変更されません。</p>
        <div className="min-w-0">
          <Textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            maxLength={2000}
            isRequired
            validationBehavior="native"
            label="修正内容の説明"
            variant="bordered"
            labelPlacement="outside"
          />
        </div>
        <div className="min-w-0 max-w-full overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm [&_td]:min-w-28 [&_th]:bg-default-100 [&_th]:p-3 [&_th]:text-left [&_td]:border-b [&_td]:border-divider [&_td]:p-3">
            <caption className="text-left">音符と休符</caption>
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
                    <Input
                      aria-label={`トラック${note.trackId + 1}・音符${note.id + 1}の音高`}
                      type="number"
                      min={0}
                      max={127}
                      onChange={(event) =>
                        updateNote(index, { pitch: Number(event.target.value) })
                      }
                      value={note.pitch == null ? "" : String(note.pitch)}
                      variant="bordered"
                      labelPlacement="outside"
                      className="min-w-0"
                    />
                  </td>
                  <td>
                    <Input
                      aria-label={`トラック${note.trackId + 1}・音符${note.id + 1}の開始位置`}
                      type="number"
                      min={0}
                      step="any"
                      onChange={(event) =>
                        updateNote(index, { start: Number(event.target.value) })
                      }
                      value={note.start == null ? "" : String(note.start)}
                      variant="bordered"
                      labelPlacement="outside"
                      className="min-w-0"
                    />
                  </td>
                  <td>
                    <Input
                      aria-label={`トラック${note.trackId + 1}・音符${note.id + 1}の長さ`}
                      type="number"
                      min={0.000_001}
                      step="any"
                      onChange={(event) =>
                        updateNote(index, {
                          duration: Number(event.target.value),
                        })
                      }
                      value={note.duration == null ? "" : String(note.duration)}
                      variant="bordered"
                      labelPlacement="outside"
                      className="min-w-0"
                    />
                  </td>
                  <td>
                    <Checkbox
                      aria-label={`トラック${note.trackId + 1}・音符${note.id + 1}を休符にする`}
                      onChange={(event) =>
                        updateNote(index, { rest: event.target.checked })
                      }
                      isSelected={note.rest}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <fieldset className="min-w-0 space-y-4 rounded-large border border-divider p-4">
          <legend>拍子</legend>
          {candidate.timesignatures.map((time, index) => (
            <div key={index}>
              <div className="min-w-0">
                <Input
                  type="number"
                  min={1}
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
                  value={time.numerator == null ? "" : String(time.numerator)}
                  label={<>拍子{index + 1}の分子</>}
                  variant="bordered"
                  labelPlacement="outside"
                  className="min-w-0"
                />
              </div>
              <div className="min-w-0">
                <Input
                  type="number"
                  min={1}
                  onChange={(event) =>
                    setCandidate((previous) => ({
                      ...previous,
                      timesignatures: previous.timesignatures.map(
                        (item, current) =>
                          current === index
                            ? {
                                ...item,
                                denominator: Number(event.target.value),
                              }
                            : item,
                      ),
                    }))
                  }
                  value={
                    time.denominator == null ? "" : String(time.denominator)
                  }
                  label="分母"
                  variant="bordered"
                  labelPlacement="outside"
                  className="min-w-0"
                />
              </div>
            </div>
          ))}
        </fieldset>
        <fieldset className="min-w-0 space-y-4 rounded-large border border-divider p-4">
          <legend>調号</legend>
          {candidate.keysignatures.map((key, index) => (
            <div key={index}>
              <div className="min-w-0">
                <Input
                  type="number"
                  min={-7}
                  max={7}
                  onChange={(event) =>
                    setCandidate((previous) => ({
                      ...previous,
                      keysignatures: previous.keysignatures.map(
                        (item, current) =>
                          current === index
                            ? {
                                ...item,
                                accidental: Number(event.target.value),
                              }
                            : item,
                      ),
                    }))
                  }
                  value={key.accidental == null ? "" : String(key.accidental)}
                  label={<>調号{index + 1}の変化数</>}
                  variant="bordered"
                  labelPlacement="outside"
                  className="min-w-0"
                />
              </div>
              <div className="min-w-0">
                <Select
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
                  label="長調・短調"
                  variant="bordered"
                  labelPlacement="outside"
                  selectedKeys={
                    String(key.tonality) === "" ? [] : [String(key.tonality)]
                  }
                  disallowEmptySelection
                  className="min-w-0"
                >
                  <SelectItem key={String(0)}>長調</SelectItem>
                  <SelectItem key={String(1)}>短調</SelectItem>
                </Select>
              </div>
            </div>
          ))}
        </fieldset>
        <fieldset className="min-w-0 space-y-4 rounded-large border border-divider p-4">
          <legend>テンポ</legend>
          {candidate.tempos.map((tempo, index) => (
            <div key={index} className="min-w-0">
              <Input
                type="number"
                min={1}
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
                value={tempo.value == null ? "" : String(tempo.value)}
                label={<>テンポ{index + 1}（BPM）</>}
                variant="bordered"
                labelPlacement="outside"
                className="min-w-0"
              />
            </div>
          ))}
        </fieldset>
        <h3 className="text-lg font-semibold">プレビュー</h3>
        <ShowScore score={{ data: candidate }} />
        <Button
          onClick={() => save(false)}
          isDisabled={pending || !summary.trim()}
          type="button"
          color="primary"
          variant="solid"
          className="max-w-full whitespace-normal"
          isLoading={pending}
        >
          下書きを保存
        </Button>
        <Button
          onClick={() => save(true)}
          isDisabled={pending || !summary.trim()}
          type="button"
          color="primary"
          variant="solid"
          className="max-w-full whitespace-normal"
          isLoading={pending}
        >
          編集案を提出
        </Button>
        <p
          role="status"
          className="empty:hidden rounded-lg bg-default-100 p-3 text-sm text-foreground"
        >
          {message}
        </p>
        <Button
          onClick={() => router.refresh()}
          type="button"
          color="default"
          variant="bordered"
          className="max-w-full whitespace-normal"
        >
          最新の状態を確認
        </Button>
      </CardBody>
    </Card>
  );
}
