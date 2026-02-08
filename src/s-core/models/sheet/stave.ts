import {
  entries,
  groupByProp,
  isArray,
  isDefined,
  last,
  map,
  pipe,
  piped,
  reduce,
} from "remeda";
import { match, P } from "ts-pattern";
import * as Sheet from ".";
import { Clef } from "../../const/musicxml/4.0/musicxml";
import * as Core from "../core";

export class Stave {
  readonly id;
  barId;
  trackId;
  clefs;
  ligature = new Sheet.Ligature(undefined, {
    type: "stave",
  });
  score!: Sheet.Score;
  get bar() {
    return this.score.bars.find(
      (bar) => bar.trackId === this.trackId && bar.id === this.barId,
    )!;
  }
  get notes() {
    return this.bar.notes.filter((note) => note.staveId === this.id);
  }
  get beamGroups() {
    return this.score.beamGroups.filter(
      (beam) =>
        beam.staveId === this.id &&
        beam.stave.trackId === this.trackId &&
        beam.stave.barId === this.barId,
    );
  }
  get chords() {
    return this.bar.chords.filter((chord) => chord.staveId === this.id);
  }
  get events() {
    return this.bar.events.filter((event) => event.staveId === this.id);
  }
  get height() {
    return -1;
  }
  get y() {
    return this.id * this.height + (this.id - 1) * 6.5;
  }
  get prev() {
    return this.bar.prev?.staves[this.id];
  }
  constructor({
    id,
    barId,
    trackId,
    clefs: clef,
  }: {
    id: number;
    barId: number;
    trackId: number;
    clefs?: Clef[];
  }) {
    this.id = id;
    this.barId = barId;
    this.trackId = trackId;
    this.clefs = clef;
  }
  serialize() {
    return {
      id: this.id,
      trackId: this.trackId,
      barId: this.barId,
      clefs: this.clefs,
    };
  }
  export() {
    return this.serialize();
  }
  static import(data: ReturnType<Stave["export"]>) {
    return new Stave(data);
  }
  draw() {
    if (this.bar.masterbar.isRowFirst)
      this.ligature.append([
        new Sheet.Glyph(
          Sheet.ElementType.Clef,
          this.resolveClefs()[0]?.$$.line?.[0]?._ ?? 0,
        ),
      ]);
    if (this.bar.masterbar.isFirst) {
      const keysignatureLigature = new Sheet.Ligature(
        (this.bar.keysignature.ligature.line = match(
          this.resolveClefs()[0]?.$$.sign![0]._,
        )
          .with("G", () => 0.5)
          .with("F", () => -0.5)
          .with(P.union("C", "TAB", "jianpu", "none", "percussion"), () => {
            throw new Error("wip");
          })
          .exhaustive()),
      );
      keysignatureLigature.append([this.bar.keysignature.ligature]);
      this.ligature.append(
        [keysignatureLigature],
        [this.bar.timesignature.ligature],
      );
    }

    this.ligature.append(
      pipe(
        this.notes,
        groupByProp("voice"),
        entries(),
        map(
          piped(
            last(),
            (notes) => {
              return reduce(
                notes,
                (accumulator, note) => {
                  if (isDefined(note.chordId)) {
                    const last = accumulator.at(-1);
                    if (isArray(last)) last.push(note);
                    else accumulator.push([note]);
                  } else accumulator.push(note);
                  return accumulator;
                },
                [] as (Sheet.Note | Sheet.Note[])[],
              );
            },
            map((noteOrChord) =>
              Array.isArray(noteOrChord)
                ? noteOrChord.map((note) => note.ligature!)
                : [noteOrChord.ligature!],
            ),
            (ligatures) => {
              const ligature = new Sheet.Ligature(undefined, {
                type: "voice",
              });
              ligature.append(...ligatures);
              return ligature;
            },
          ),
        ),
      ),
    );
  }
  resolveClefs(): Clef[] {
    return this.clefs ?? this.prev!.resolveClefs();
  }
  getClefScientificPitchNotation() {
    return new Core.Units.ScientificPitchNotation(
      match(this.resolveClefs()[0]?.$$.sign![0]._)
        .with("G", (value) => `${value}4`)
        .with("F", (value) => `${value}3`)
        .with(P.union("C", "TAB", "jianpu", "none", "percussion"), () => {
          throw new Error("wip");
        })
        .exhaustive(),
    );
  }
}
