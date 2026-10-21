import { copyNotation } from "../sheet/notation/schema";
import {
  importCandidateSchema,
  partialScoreSchema,
  type ImportCandidate,
  type ConversionIssue,
} from "./contracts";
import { sheetScoreSchema } from "./score-schema";
import { convertJson } from "./json";
/** Promote only when every required musical field is known; retain original notation when available. */
export function promotePartial(input: unknown): {
  candidate: ImportCandidate;
  issues: ConversionIssue[];
} {
  const parsed = importCandidateSchema.parse(input);
  if (!("format" in parsed) || parsed.format !== "converted-partial-v1")
    return { candidate: parsed, issues: [] };
  const candidate = partialScoreSchema.parse(parsed);
  if (
    candidate.notation &&
    typeof candidate.notation === "object" &&
    !Array.isArray(candidate.notation) &&
    candidate.notation.layoutIncomplete === true
  )
    return { candidate, issues: [] };
  if (
    candidate.notes.some(
      (note) =>
        (!note.rest &&
          note.pitch === null &&
          !note.tablature &&
          !note.percussion) ||
        note.onset === null ||
        note.duration === null,
    )
  )
    return { candidate, issues: [] };
  if (
    candidate.notation &&
    typeof candidate.notation === "object" &&
    !Array.isArray(candidate.notation)
  ) {
    const full = sheetScoreSchema.parse({
      ...candidate.notation,
      notes: candidate.notes.map((note) => ({
        ...copyNotation(note),
        ...(note.stem ? { stem: note.stem } : {}),
        ...(note.beam ? { beam: note.beam } : {}),
        ...(note.channel === undefined ? {} : { channel: note.channel }),
        id: Number(note.id),
        trackId: note.trackId,
        staveId: note.staveId ?? 0,
        voice: note.voice ?? 1,
        pitch: note.pitch,
        velocity: note.velocity,
        rest: note.rest,
        start: note.onset!,
        duration: note.duration!,
        end: note.onset! + note.duration!,
        ...(note.chordId === undefined ? {} : { chordId: note.chordId }),
        ...(note.ties ? { ties: note.ties } : {}),
        ...(note.notatedType
          ? { notatedType: note.notatedType, notatedDots: note.notatedDots }
          : {}),
      })),
    });
    return { candidate: full, issues: [] };
  }
  const preservePartial = () => ({
    candidate,
    issues: [
      {
        id: "notation:promotion",
        code: "NOTATION_PROMOTION_AMBIGUOUS",
        severity: "BLOCKING" as const,
        status: "UNRESOLVED" as const,
        message:
          "元の譜表・声部と昇格先を一意に対応付けられません。表記情報を保持した不完全候補として残します。原譜の再取り込みか音の配置を確認してください。",
      },
    ],
  });
  if (candidate.notes.some((note) => note.rest || note.pitch === null))
    return preservePartial();
  const converted = convertJson({
    tempos: candidate.tempos,
    timesignatures: candidate.timesignatures,
    keysignatures: candidate.keysignatures,
    tracks: candidate.tracks.map((track) => ({
      name: track.name,
      preset: track.preset,
      notes: candidate.notes
        .filter((note) => note.trackId === track.id)
        .map((note) => ({
          pitch: note.pitch!,
          velocity: note.velocity,
          start: note.onset!,
          duration: note.duration!,
          ...(note.channel === undefined ? {} : { channel: note.channel }),
        })),
    })),
  });
  if (!("format" in converted.candidate)) {
    const full = converted.candidate;
    const sourceTracks = candidate.tracks;
    for (const track of sourceTracks) {
      const source = candidate.notes.filter(
        (note) => note.trackId === track.id,
      );
      const target = full.notes.filter(
        (note) => note.trackId === sourceTracks.indexOf(track) && !note.rest,
      );
      for (const note of target) {
        const matches = source.filter(
          (item) =>
            !item.rest &&
            item.pitch === note.pitch &&
            item.onset !== null &&
            item.duration !== null &&
            note.start >= item.onset - 1e-9 &&
            note.end <= item.onset + item.duration + 1e-9,
        );
        if (matches.length !== 1) return preservePartial();
        const original = matches[0];
        Object.assign(note, copyNotation(original), {
          ...(original.stem ? { stem: original.stem } : {}),
          ...(original.beam ? { beam: original.beam } : {}),
          ...(original.notatedType
            ? {
                notatedType: original.notatedType,
                notatedDots: original.notatedDots,
              }
            : {}),
          ...(original.ties
            ? { ties: [...new Set([...(note.ties ?? []), ...original.ties])] }
            : {}),
        });
      }
    }
    return {
      candidate: sheetScoreSchema.parse(full),
      issues: converted.issues,
    };
  }
  return { candidate: converted.candidate, issues: converted.issues };
}
