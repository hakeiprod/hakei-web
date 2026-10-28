import { filter, firstBy, isIncludedIn, pipe, prop, times } from "remeda";
import { match, P } from "ts-pattern";
import * as Sheet from ".";
import * as Core from "../core";
export class Chord extends Core.Event<{ id: number }> {
  readonly id;
  score!: Sheet.Score;
  get notes() {
    return this.score.getNotesByChordId(this.id);
  }
  get maxPitchNote() {
    return pipe(
      this.notes,
      filter((note) => !note.rest && note.pitch !== null),
      firstBy([(note) => note.pitch?.value ?? 0, "desc"]),
    );
  }
  get minPitchNote() {
    return pipe(
      this.notes,
      filter((note) => !note.rest && note.pitch !== null),
      firstBy((note) => note.pitch?.value ?? 0),
    );
  }
  get keysignature() {
    return this.notes[0].keysignature;
  }
  get slot() {
    if (this.score.layoutIndex)
      return this.score.layoutIndex.chordSlot.get(this)!;
    return this.score.slots.find((slot) => slot.chords.includes(this))!;
  }
  get stave() {
    if (this.score.layoutIndex)
      return this.score.layoutIndex.chordStave.get(this)!;
    return this.notes[0].stave;
  }
  get track() {
    if (this.score.layoutIndex)
      return this.score.layoutIndex.chordTrack.get(this)!;
    return this.notes[0].track;
  }
  get beamGroup() {
    if (this.score.layoutIndex)
      return this.score.layoutIndex.chordBeams.get(this)?.[0];
    return this.score.beamGroups.find((beamGroup) =>
      isIncludedIn(this.id, pipe(beamGroup.chordIds)),
    );
  }
  get start() {
    return firstBy(this.notes, prop("start"))!.start;
  }
  get end() {
    return firstBy(this.notes, [prop("end"), "desc"])!.end;
  }
  get voice() {
    return this.notes[0].voice;
  }
  get stem() {
    if (this.notes.every((note) => note.rest)) return;
    return this.notes[0].stem;
  }
  get beam() {
    return this.notes[0].beam;
  }
  get height(): number {
    throw new Error("Chord height requires an engraving model.");
  }
  get right(): number {
    throw new Error("Chord bounds require an engraving model.");
  }
  get left(): number {
    throw new Error("Chord bounds require an engraving model.");
  }
  get width() {
    return firstBy(this.notes, [prop("width"), "desc"])?.width ?? 0;
  }
  get line() {
    return firstBy(this.notes, [prop("line"), "desc"])?.line ?? 0;
  }
  get stemX() {
    return match(this.stem?._ ?? "none")
      .with("up", () => this.right)
      .with("down", () => this.left)
      .with("double", () => {
        throw new Error("wip");
      })
      .with("none", () => 0)
      .exhaustive();
  }
  get stemLength() {
    return this.beamGroup?.calculateStemLength(this) ?? 3;
  }
  get legerlines() {
    if (!this.maxPitchNote || !this.minPitchNote) return [];
    const bounds = match(this.stave.resolveClefs()[0]?.sign![0]._)
      .with("G", () => ({
        max: new Core.Units.ScientificPitchNotation("F5"),
        min: new Core.Units.ScientificPitchNotation("E4"),
      }))
      .with("F", () => ({
        max: new Core.Units.ScientificPitchNotation("A3"),
        min: new Core.Units.ScientificPitchNotation("G2"),
      }))
      .with(P.union("C", "TAB", "jianpu", "none", "percussion"), () => {
        throw new Error("wip");
      })
      .exhaustive();
    return [
      ...times(
        this.maxPitchNote
          .pitch!.toScientificPitchNotation(this.keysignature)
          .getDegree(bounds.max) / 2,
        (index) => index + 6,
      ),
      ...times(
        bounds.min.getDegree(
          this.minPitchNote.pitch!.toScientificPitchNotation(this.keysignature),
        ) / 2,
        (index) => index,
      ),
    ];
  }
  constructor({ id, ...event }: { id: number }) {
    super(event);
    this.id = id;
  }
  serialize() {
    return { id: this.id };
  }
  export() {
    return this.serialize();
  }
  static import(data: ReturnType<Chord["export"]>) {
    return new Chord(data);
  }
}
