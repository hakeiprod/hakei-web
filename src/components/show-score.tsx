"use client";
import {
  TableColumn,
  TableHeader,
  TableCell,
  TableRow,
  TableBody,
  Table,
  CardBody,
  Card,
} from "@heroui/react";
import { partialScoreSchema } from "@/s-core/models/import/contracts";
import { sheetScoreSchema } from "@/s-core/models/import/score-schema";
import * as Audio from "@/s-core/models/audio";
import { NoteHighlighter } from "@/s-core/models/audio_sheet/note-highlighter";
import * as BrowserAudio from "@/s-core/models/browser/audio";
import { Keyboard } from "@/s-core/models/browser/keyboard";
import Soundfont2 from "@/s-core/models/files/soundfont2";
import * as Sheet from "@/s-core/models/sheet";
import "@/s-core/models/sheet/extensions/to-audio";
import * as Engraving from "@/s-core/models/engraving";
import { masterVolumeAtom } from "@/store/master-volume";
import { getDefaultStore } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { ScoreMixier } from "./score-mixier";
import { ScorePlayer } from "./score-player";
import { ScoreViewer } from "./score-viewer";
import { VirtualKeyboard } from "./virtual-keyboard";
export function ShowScore(properties: {
  score: {
    data: unknown;
    revisionNumber?: number;
  };
  canPlay?: boolean;
}) {
  const partial = partialScoreSchema.safeParse(properties.score.data);
  if (partial.success)
    return (
      <Card
        as="section"
        className="min-w-0 overflow-visible border border-divider bg-content1"
      >
        <CardBody className="min-w-0 space-y-4 p-4 sm:p-6">
          <p
            role="status"
            className="empty:hidden rounded-lg bg-default-100 p-3 text-sm text-foreground"
          >
            不明な音高・開始位置・長さがあるため、練習・ゲームには利用できません。
          </p>
          <div className="min-w-0 max-w-full overflow-x-auto">
            <Table
              aria-label="既知の音符（先頭50個）"
              selectionMode="none"
              className="min-w-0"
              topContent={
                <p className="text-sm font-medium">既知の音符（先頭50個）</p>
              }
            >
              <TableHeader>
                <TableColumn>トラック</TableColumn>
                <TableColumn>音高</TableColumn>
                <TableColumn>開始（拍）</TableColumn>
                <TableColumn>長さ（拍）</TableColumn>
              </TableHeader>
              <TableBody>
                {partial.data.notes.slice(0, 50).map((note) => (
                  <TableRow key={`${note.trackId}:${note.id}`}>
                    <TableCell>{note.trackId + 1}</TableCell>
                    <TableCell>
                      {note.rest ? "休符" : (note.pitch ?? "不明")}
                    </TableCell>
                    <TableCell>{note.onset ?? "不明"}</TableCell>
                    <TableCell>{note.duration ?? "不明"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardBody>
      </Card>
    );
  const parsed = sheetScoreSchema.safeParse(properties.score.data);
  if (!parsed.success)
    return <p role="alert">楽譜のデータを表示できません。修正が必要です。</p>;
  if (parsed.data.notes.length === 0)
    return <p>この楽譜には音符がありません。</p>;
  return (
    <>
      <p>版 {properties.score.revisionNumber ?? 1}</p>
      <ValidatedScore data={parsed.data} canPlay={properties.canPlay ?? true} />
    </>
  );
}
function ValidatedScore(properties: { data: unknown; canPlay: boolean }) {
  const [soundfont2, setSoundfont2] = useState<Soundfont2>();
  const scoreData = properties.data as unknown as ReturnType<
    Sheet.Score["export"]
  >;
  const audio = useMemo(
    () => Sheet.Score.import(scoreData).toAudio(),
    [scoreData],
  );
  const keyboard = useMemo(
    () =>
      properties.canPlay && audio.notes.length > 0
        ? new Keyboard(audio.keyRange)
        : undefined,
    [audio, properties.canPlay],
  );
  const smufl = useMemo(() => Engraving.Score.import(scoreData), [scoreData]);
  const [controller, setController] = useState<BrowserAudio.Controller>();
  useEffect(() => {
    if (
      !properties.canPlay ||
      !soundfont2 ||
      audio.notes.length === 0 ||
      typeof AudioContext === "undefined"
    )
      return;
    const next = new BrowserAudio.Controller(
      audio,
      soundfont2,
      new Audio.Units.Volume(getDefaultStore().get(masterVolumeAtom)).toGain(),
    );
    next.mount();
    // The controller owns browser resources and must be created after commit.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setController(next);
    return () => next.unmount();
  }, [audio, soundfont2, properties.canPlay]);
  useEffect(() => {
    if (!controller) return;
    const highlighter = new NoteHighlighter(smufl, controller);
    highlighter.highlight();
    return () => highlighter.stop();
  }, [controller, smufl]);
  useEffect(() => {
    if (!properties.canPlay) return;
    const abort = new AbortController();
    fetch("/A320U.sf2", { signal: abort.signal })
      .then((response) => response.arrayBuffer())
      .then((buffer) => {
        if (!abort.signal.aborted) setSoundfont2(Soundfont2.create(buffer));
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) console.error(error);
      });
    return () => abort.abort();
  }, [properties.canPlay]);
  return (
    <>
      <ScoreViewer score={smufl} />
      {properties.canPlay && controller && (
        <ScorePlayer score={audio} controller={controller} />
      )}
      {properties.canPlay && audio.notes.length > 0 && (
        <ScoreMixier score={audio} />
      )}
      {keyboard && <VirtualKeyboard keyboard={keyboard} />}
    </>
  );
}
