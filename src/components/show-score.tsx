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
import { capabilities } from "@/s-core/models/sheet/notation/capabilities";
import { partialScoreSchema } from "@/s-core/models/import/contracts";
import {
  createSourceSnapshot,
  tryCreateSmallSourceSnapshot,
  type SourceSnapshot,
} from "@/s-core/models/browser/render-score";
import {
  yieldToTask,
  yieldToPaint,
  drainCooperatively,
} from "@/s-core/models/browser/render-scheduler";
import * as Audio from "@/s-core/models/audio";
import { NoteHighlighter } from "@/s-core/models/audio_sheet/note-highlighter";
import * as BrowserAudio from "@/s-core/models/browser/audio";
import { Keyboard } from "@/s-core/models/browser/keyboard";
import Soundfont2 from "@/s-core/models/files/soundfont2";
import "@/s-core/models/sheet/extensions/to-audio";
import * as Engraving from "@/s-core/models/engraving";
import { masterVolumeAtom } from "@/store/master-volume";
import { getDefaultStore } from "jotai";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useRef,
  memo,
  useCallback,
} from "react";
import { ScoreMixier } from "./score-mixier";
import { ScorePlayer, type PlaybackState } from "./score-player";
import { ScoreViewer } from "./score-viewer";
import { VirtualKeyboard } from "./virtual-keyboard";
export function ShowScore(properties: {
  score: {
    data: unknown;
    id?: number | string;
    revisionId?: string;
    revisionNumber?: number;
  };
  canPlay?: boolean;
}) {
  const inputIdentity =
    properties.score.id !== undefined &&
    (properties.score.revisionId !== undefined ||
      properties.score.revisionNumber !== undefined)
      ? JSON.stringify([
          properties.score.id,
          properties.score.revisionId ?? properties.score.revisionNumber,
        ])
      : properties.score.data;
  const generation = useRef(0);
  const [display, setDisplay] = useState<
    | ({
        input: unknown;
        revision: number | undefined;
        generation: number;
      } & (
        | { kind: "partial"; data: ReturnType<typeof partialScoreSchema.parse> }
        | {
            kind: "ready";
            source: SourceSnapshot;
            capability: ReturnType<typeof capabilities>;
          }
        | { kind: "error" }
      ))
    | undefined
  >(() => {
    const input = inputIdentity,
      revision = properties.score.revisionNumber;
    try {
      const data = properties.score.data;
      if (
        data &&
        typeof data === "object" &&
        Object.getOwnPropertyDescriptor(data, "format")?.value ===
          "converted-partial-v1"
      )
        return;
      const source = tryCreateSmallSourceSnapshot(data);
      if (!source) return;
      return {
        kind: "ready",
        source,
        // Keep this bounded initial render free of schema code generation too.
        capability: capabilities(source.data, [], { jitless: true }),
        input,
        revision,
        generation: 0,
      };
    } catch {
      return { kind: "error", input, revision, generation: 0 };
    }
  });
  useLayoutEffect(() => {
    if (
      display?.generation === 0 &&
      display.input === inputIdentity &&
      display.revision === properties.score.revisionNumber
    )
      return;
    const abort = new AbortController(),
      own = ++generation.current,
      input = inputIdentity,
      revision = properties.score.revisionNumber;
    const run = async () => {
      try {
        let completeInput = properties.score.data;
        if (
          completeInput &&
          typeof completeInput === "object" &&
          "format" in completeInput &&
          completeInput.format === "converted-partial-v1"
        ) {
          const captured = structuredClone(completeInput);
          await yieldToTask(abort.signal);
          const partial = partialScoreSchema.safeParse(captured);
          if (partial.success) {
            if (!abort.signal.aborted)
              setDisplay({
                kind: "partial",
                data: partial.data,
                input,
                revision,
                generation: own,
              });
            return;
          }
          completeInput = captured;
        }
        // The snapshot captures complete input before its first suspension.
        // Cloning here as well doubles allocations during reload validation.
        const source = await createSourceSnapshot(completeInput, abort.signal);
        if (!abort.signal.aborted)
          setDisplay({
            kind: "ready",
            source,
            capability: capabilities(source.data),
            input,
            revision,
            generation: own,
          });
      } catch {
        if (!abort.signal.aborted)
          setDisplay({ kind: "error", input, revision, generation: own });
      }
    };
    run();
    return () => abort.abort();
    // Persisted id/revision identifies immutable Git data, even if RSC recreates JSON.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputIdentity, properties.score.revisionNumber]);
  if (
    !display ||
    display.input !== inputIdentity ||
    display.revision !== properties.score.revisionNumber
  )
    return (
      <>
        <p>版 {properties.score.revisionNumber ?? 1}</p>
        <ValidatedScore key={(display?.generation ?? 0) + 1} canPlay={false} />
      </>
    );
  if (display.kind === "error")
    return <p role="alert">楽譜のデータを表示できません。修正が必要です。</p>;
  if (display.kind === "partial")
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
                {display.data.notes.slice(0, 50).map((note) => (
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
  if (display.source.data.notes.length === 0)
    return <p>この楽譜には音符がありません。</p>;
  return (
    <>
      <p>版 {properties.score.revisionNumber ?? 1}</p>
      {display.capability.reasons.map((r) => (
        <p key={r.code} role="status">
          {r.message}
        </p>
      ))}
      <ValidatedScore
        key={display.generation}
        source={display.source}
        canPlay={(properties.canPlay ?? true) && display.capability.canPlayback}
      />
    </>
  );
}
const ValidatedScore = memo(function ValidatedScore(properties: {
  source?: SourceSnapshot;
  canPlay: boolean;
}) {
  const [soundfont2, setSoundfont2] = useState<Soundfont2>();
  const [smufl, setSmufl] = useState<Engraving.Score>();
  const [renderReady, setRenderReady] = useState(false);
  const [audio, setAudio] = useState<Audio.Score>();
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const hasPublished = useRef(false);
  const prepareInitialScore = useCallback(
    function* (score: Engraving.Score) {
      if (
        !hasPublished.current &&
        properties.canPlay &&
        typeof AudioContext !== "undefined"
      )
        yield* NoteHighlighter.initialSteps(score);
    },
    [properties.canPlay],
  );
  const publishScore = useCallback((score: Engraving.Score) => {
    hasPublished.current = true;
    setSmufl(score);
  }, []);
  useEffect(() => {
    if (!properties.canPlay || !smufl || audio) return;
    const abort = new AbortController();
    const prepare = async () => {
      try {
        await yieldToPaint(abort.signal);
        // A frame callback's promise continuation still runs before that frame
        // is submitted. Start secondary audio work in a fresh background task.
        await yieldToTask(abort.signal, undefined, "background");
        const next = await drainCooperatively(smufl.toAudioSteps(), {
          signal: abort.signal,
          priority: "background",
        });
        if (!abort.signal.aborted) setAudio(next);
      } catch (error) {
        if (!abort.signal.aborted) console.error(error);
      }
    };
    prepare();
    return () => abort.abort();
  }, [smufl, audio, properties.canPlay]);
  const keyboard = useMemo(
    () =>
      properties.canPlay && audio && audio.notes.length > 0 && audio.keyRange
        ? new Keyboard(audio.keyRange)
        : undefined,
    [audio, properties.canPlay],
  );
  const [controller, setController] = useState<BrowserAudio.Controller>();
  useEffect(() => {
    if (
      !properties.canPlay ||
      !audio ||
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
    if (!controller || !smufl || !renderReady) return;
    const highlighter = new NoteHighlighter(smufl, controller);
    highlighter.highlight(playbackState === "playing");
    // The same-source SVG remains visible while its replacement is prepared.
    // Stop animation without invalidating the retained drawing's paint.
    return () => highlighter.stop({ preserveClasses: true });
  }, [controller, smufl, renderReady, playbackState]);
  useEffect(() => {
    if (!properties.canPlay || !renderReady || soundfont2) return;
    const abort = new AbortController();
    fetch("/A320U.sf2", { signal: abort.signal })
      .then((response) => response.arrayBuffer())
      .then(async (buffer) => {
        await yieldToPaint(abort.signal);
        if (!abort.signal.aborted) setSoundfont2(Soundfont2.create(buffer));
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) console.error(error);
      });
    return () => abort.abort();
  }, [properties.canPlay, renderReady, soundfont2]);
  return (
    <>
      <ScoreViewer
        source={properties.source}
        onReady={publishScore}
        onStatusChange={setRenderReady}
        prepareInitialScore={prepareInitialScore}
      />
      {properties.canPlay && audio && controller && (
        <div
          inert={!renderReady}
          style={{ visibility: renderReady ? "visible" : "hidden" }}
        >
          <ScorePlayer
            score={audio}
            controller={controller}
            onStateChange={setPlaybackState}
          />
        </div>
      )}
      {properties.canPlay &&
        audio &&
        audio.notes.length > 0 &&
        audio.keyRange && <ScoreMixier score={audio} />}
      {keyboard && <VirtualKeyboard keyboard={keyboard} />}
    </>
  );
});
