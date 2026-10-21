import { z } from "zod";

export const stepSemitones = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
} as const;
export const accidentalAlter = {
  sharp: 1,
  flat: -1,
  natural: 0,
  "double-sharp": 2,
  "double-flat": -2,
} as const;
export const notatedPitchSchema = z
  .object({
    step: z.enum(["C", "D", "E", "F", "G", "A", "B"]),
    octave: z.int().min(-1).max(9),
    alter: z.int().min(-2).max(2),
  })
  .strict();
export const explicitAccidentalSchema = z
  .object({
    kind: z.enum(["sharp", "flat", "natural", "double-sharp", "double-flat"]),
    cautionary: z.boolean().optional(),
    parentheses: z.boolean().optional(),
  })
  .strict();
export const visualTiesSchema = z
  .array(
    z
      .object({
        type: z.enum(["start", "stop", "continue"]),
        number: z.int().min(1).max(16).optional(),
        placement: z.enum(["above", "below"]).optional(),
        orientation: z.enum(["over", "under"]).optional(),
      })
      .strict(),
  )
  .max(32)
  .refine(
    (items) =>
      new Set(items.map((item) => `${item.type}:${item.number ?? ""}`)).size ===
      items.length,
    "Duplicate visual tie",
  );
export const tablatureSchema = z
  .object({ string: z.int().min(1).max(6), fret: z.int().min(0).max(36) })
  .strict();
export const percussionSchema = z
  .object({
    displayStep: z.enum(["A", "B", "C", "D", "E", "F", "G"]),
    displayOctave: z.int().min(-1).max(9),
    notehead: z.enum(["normal", "x"]),
    instrumentId: z.string().min(1).max(200).optional(),
    midiNote: z.int().min(0).max(127).optional(),
    midiChannel: z.int().min(0).max(15).optional(),
  })
  .strict();
export const sourceNotationSchema = z
  .json()
  .refine(
    (v) => new TextEncoder().encode(JSON.stringify(v)).length <= 65_536,
    "Notation source exceeds limit",
  );
export const notationShape = {
  tablature: tablatureSchema.optional(),
  percussion: percussionSchema.optional(),
  performanceEventId: z.string().min(1).max(200).optional(),
  sourceNotation: sourceNotationSchema.optional(),
  notatedPitch: notatedPitchSchema.optional(),
  explicitAccidental: explicitAccidentalSchema.optional(),
  visualTies: visualTiesSchema.optional(),
};
export type NotatedPitch = z.infer<typeof notatedPitchSchema>;
export type ExplicitAccidental = z.infer<typeof explicitAccidentalSchema>;
export type VisualTie = z.infer<typeof visualTiesSchema>[number];
export interface NotationFields {
  tablature?: z.infer<typeof tablatureSchema>;
  percussion?: z.infer<typeof percussionSchema>;
  performanceEventId?: string;
  sourceNotation?: z.infer<typeof sourceNotationSchema>;
  notatedPitch?: NotatedPitch;
  explicitAccidental?: ExplicitAccidental;
  visualTies?: VisualTie[];
}
export function notationPitch(pitch: NotatedPitch) {
  return (pitch.octave + 1) * 12 + stepSemitones[pitch.step] + pitch.alter;
}
export function validateNotation(
  note: NotationFields & {
    pitch?: number | null;
    rest?: boolean;
    ties?: string[];
  },
  context: z.RefinementCtx,
) {
  if (note.tablature && note.percussion)
    context.addIssue({ code: "custom", message: "Conflicting notation kinds" });
  if (note.percussion && (note.notatedPitch || note.explicitAccidental))
    context.addIssue({
      code: "custom",
      message: "Unpitched notation cannot have a pitched spelling",
    });
  if (
    note.rest &&
    (note.tablature || note.percussion || note.performanceEventId)
  )
    context.addIssue({
      code: "custom",
      message: "Rest cannot have hit notation",
    });
  if (
    note.rest &&
    (note.notatedPitch ||
      note.explicitAccidental ||
      note.visualTies?.length ||
      note.ties?.length)
  )
    context.addIssue({
      code: "custom",
      path: ["rest"],
      message: "Rest cannot have pitched notation or ties",
    });
  if (note.notatedPitch) {
    const pitch = notationPitch(note.notatedPitch);
    if (
      pitch < 0 ||
      pitch > 127 ||
      (note.pitch != null && note.pitch !== pitch)
    )
      context.addIssue({
        code: "custom",
        path: ["notatedPitch"],
        message: "Notation pitch does not match sounding pitch",
      });
    if (
      note.explicitAccidental &&
      accidentalAlter[note.explicitAccidental.kind] !== note.notatedPitch.alter
    )
      context.addIssue({
        code: "custom",
        path: ["explicitAccidental"],
        message: "Accidental does not match pitch alteration",
      });
  }
}
export const notationSchema = z
  .object({
    ...notationShape,
    pitch: z.int().min(0).max(127).nullable().optional(),
    rest: z.boolean().optional(),
    ties: z.array(z.enum(["start", "stop"])).optional(),
  })
  .superRefine(validateNotation);
/** Only copy supplied notation; never synthesize metadata for legacy scores. */
export function copyNotation(note: NotationFields) {
  return {
    ...(note.tablature ? { tablature: { ...note.tablature } } : {}),
    ...(note.percussion ? { percussion: { ...note.percussion } } : {}),
    ...(note.performanceEventId === undefined
      ? {}
      : { performanceEventId: note.performanceEventId }),
    ...(note.sourceNotation === undefined
      ? {}
      : { sourceNotation: structuredClone(note.sourceNotation) }),
    ...(note.notatedPitch === undefined
      ? {}
      : { notatedPitch: { ...note.notatedPitch } }),
    ...(note.explicitAccidental === undefined
      ? {}
      : { explicitAccidental: { ...note.explicitAccidental } }),
    ...(note.visualTies === undefined
      ? {}
      : { visualTies: note.visualTies.map((tie) => ({ ...tie })) }),
  };
}
