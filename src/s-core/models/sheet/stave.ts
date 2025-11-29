import * as Core from "../core";
import * as Sheet from ".";
import { Clef } from "../../const/musicxml/4.0/musicxml";
import { match, P } from "ts-pattern";
import {
  entries,
  groupByProp,
  map,
  pipe,
  piped,
  last,
  isDefined,
  isArray,
  reduce,
} from "remeda";

export class Stave {
  readonly id;
  barId;
  trackId;
  clefs;
  ligature = new Sheet.Ligature(undefined, {
    type: "stave",
  });
  score!: Sheet.Score;
  get params() {
    return {
      id: this.id,
      barId: this.barId,
      trackId: this.trackId,
      clefs: this.clefs,
    };
  }
  get bar() {
    return this.score.bars.find(
      (bar) => bar.trackId === this.trackId && bar.id === this.barId
    )!;
  }
  get notes() {
    return this.bar.notes.filter((note) => note.staveId === this.id);
  }
  get chords() {
    return this.bar.chords.filter((chord) => chord.staveId === this.id);
  }
  get beams() {
    return pipe(
      this.notes,
      reduce(
        (accumulator, current) => {
          for (const beam of current.beam ?? []) {
            const level = Number(beam.$?.number) - 1;
            match(beam._)
              .with("begin", () =>
                accumulator.push({ level, notes: [current] })
              )
              .with(P.union("continue", "end"), () => {
                accumulator
                  .findLast((beam) => beam.level === level)
                  ?.notes.push(current);
              })
              .with(P.union("backward hook", "forward hook"), () => {
                throw new Error("wip");
              })
              .exhaustive();
          }
          return accumulator;
        },
        [] as { level: number; notes: Sheet.Note[] }[]
      )
    );
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
          this.resolveClefs()[0]?.$$.line?.[0]?._ ?? 0
        ),
      ]);
    if (this.bar.masterbar.isFirst) {
      this.bar.keysignature.ligature.line = match(
        this.resolveClefs()[0]?.$$.sign![0]._
      )
        .with("G", () => 0)
        .with("F", () => -1)
        .with(P.union("C", "TAB", "jianpu", "none", "percussion"), () => {
          throw new Error("wip");
        })
        .exhaustive();
      this.ligature.append(
        [this.bar.keysignature.ligature],
        [this.bar.timesignature.ligature]
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
                [] as (Sheet.Note | Sheet.Note[])[]
              );
            },
            map((noteOrChord) =>
              Array.isArray(noteOrChord)
                ? noteOrChord.map((note) => note.ligature!)
                : [noteOrChord.ligature!]
            ),
            (ligatures) => {
              const ligature = new Sheet.Ligature(undefined, {
                type: "voice",
              });
              ligature.append(...ligatures);
              return ligature;
            }
          )
        )
      )
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
        .exhaustive()
    );
  }
}
