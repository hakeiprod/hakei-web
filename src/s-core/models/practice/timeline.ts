import { capabilities } from "../sheet/notation/capabilities";
import { performanceNotes } from "../sheet/notation/performance-events";
import { z } from "zod";
import { Beat } from "../core/units/beat";
import { Microseconds } from "../core/units/microseconds";
import { TempoMap } from "./tempo-map";
import { Conditions } from "./conditions";
import { sheetScoreSchema } from "../import/score-schema";
import { type PracticeTimeline, type PracticeConditions } from "./contracts";
function deriveTimeline(
  input: unknown,
  rawConditions: PracticeConditions,
): PracticeTimeline {
  const score = sheetScoreSchema.parse(input);
  if (!capabilities(score).canPractice)
    throw new Error("Score practice is unavailable");
  const conditions = rawConditions;
  if (!score.tracks.some((track) => track.id === conditions.trackId))
    throw new Error("INVALID_TRACK");
  const startBar = score.masterbars.find(
    (bar) => bar.id === conditions.rangeStartBar - 1,
  );
  const endBar = score.masterbars.find(
    (bar) => bar.id === conditions.rangeEndBar - 1,
  );
  if (!startBar || !endBar || endBar.end <= startBar.start)
    throw new Error("INVALID_RANGE");
  const map = new TempoMap(score.tempos, conditions.tempoScale);
  const timeAt = (beat: number) => map.microsecondsAt(new Beat(beat));
  const origin = timeAt(startBar.start);
  const durationUs = Math.round(timeAt(endBar.end) - origin);
  if (durationUs <= 0 || durationUs > 1_800_000_000)
    throw new Error("TIMELINE_LIMIT");
  const notes: PracticeTimeline["notes"] = [];
  const continuations: PracticeTimeline["continuations"] = [];
  const tieLeads = new Map<
    string,
    | PracticeTimeline["notes"][number]
    | PracticeTimeline["continuations"][number]
  >();
  for (const note of performanceNotes(score.notes).toSorted(
    (a, b) => a.start - b.start || a.id - b.id,
  )) {
    if (
      note.trackId !== conditions.trackId ||
      note.rest ||
      note.end <= startBar.start ||
      note.start >= endBar.end
    )
      continue;
    if (note.pitch === null) throw new Error("Missing sounding pitch");
    const key = `${note.trackId}:${note.voice}:${note.staveId}:${note.pitch}`;
    const onsetUs = Math.max(0, Math.round(timeAt(note.start) - origin));
    const endUs = Math.round(timeAt(Math.min(note.end, endBar.end)) - origin);
    const common = {
      noteId: `${note.trackId}:${note.id}`,
      trackId: note.trackId,
      pitch: note.pitch,
      onsetUs,
      durationUs: endUs - onsetUs,
    };
    if (common.durationUs <= 0) throw new Error("TIMELINE_LIMIT");
    if (note.start < startBar.start || note.ties?.includes("stop")) {
      const lead = tieLeads.get(key);
      if (lead) {
        lead.durationUs = endUs - lead.onsetUs;
        continuations.push({ ...common, continuedFrom: lead.noteId });
      } else {
        continuations.push(common);
        tieLeads.set(key, common);
      }
      if (!note.ties?.includes("start")) tieLeads.delete(key);
      continue;
    }
    const bar = score.masterbars.find(
      (bar) => note.start >= bar.start && note.start < bar.end,
    );
    if (!bar) throw new Error("INVALID_NOTE_BAR");
    const attack = {
      ...common,
      barNumber: bar.id + 1,
      ...(note.chordId === undefined ? {} : { chordId: note.chordId }),
    };
    notes.push(attack);
    if (note.ties?.includes("start")) tieLeads.set(key, attack);
  }
  const bars = score.masterbars
    .filter(
      (bar) =>
        bar.id >= conditions.rangeStartBar - 1 &&
        bar.id <= conditions.rangeEndBar - 1,
    )
    .map((bar) => ({
      barNumber: bar.id + 1,
      startUs: Math.round(timeAt(bar.start) - origin),
      endUs: Math.round(timeAt(bar.end) - origin),
    }))
    .toSorted((a, b) => a.startUs - b.startUs);
  return {
    bars,
    notes: notes.toSorted(
      (a, b) =>
        a.onsetUs - b.onsetUs ||
        (a.noteId < b.noteId ? -1 : a.noteId > b.noteId ? 1 : 0),
    ),
    continuations,
    durationUs,
    rangeStartBeat: startBar.start,
    rangeEndBeat: endBar.end,
  };
}

/** Expectations for one immutable score snapshot and a selected practice range. */
export class Timeline {
  readonly duration: Microseconds;
  private constructor(private readonly data: PracticeTimeline) {
    this.duration = new Microseconds(data.durationUs);
  }
  static import(input: unknown) {
    const time = z.int().nonnegative();
    const note = z
      .object({
        noteId: z.string(),
        trackId: z.int().nonnegative(),
        pitch: z.int().min(0).max(127),
        onsetUs: time,
        durationUs: time,
      })
      .strict();
    const data = z
      .object({
        bars: z.array(
          z
            .object({
              barNumber: z.int().positive(),
              startUs: time,
              endUs: time,
            })
            .strict(),
        ),
        notes: z.array(
          note.extend({
            barNumber: z.int().positive(),
            chordId: z.int().optional(),
          }),
        ),
        continuations: z.array(
          note.extend({ continuedFrom: z.string().optional() }),
        ),
        durationUs: time.positive().max(1_800_000_000),
        rangeStartBeat: z.number().finite().nonnegative(),
        rangeEndBeat: z.number().finite().nonnegative(),
      })
      .strict()
      .parse(input);
    if (
      data.rangeEndBeat <= data.rangeStartBeat ||
      data.bars.some((bar) => bar.endUs < bar.startUs)
    )
      throw new Error("INVALID_RANGE");
    return new Timeline(data);
  }
  static create(score: unknown, conditions: Conditions) {
    return new Timeline(deriveTimeline(score, conditions.export()));
  }
  get notes() {
    return this.data.notes.map((note) => ({ ...note }));
  }
  export(): PracticeTimeline {
    return structuredClone(this.data);
  }
}
