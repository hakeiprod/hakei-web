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
        (!note.rest && note.pitch === null) ||
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
        id: Number(note.id),
        trackId: note.trackId,
        staveId: note.staveId ?? 0,
        voice: note.voice ?? 1,
        pitch: note.rest ? 0 : note.pitch!,
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
  return { candidate: converted.candidate, issues: converted.issues };
}
