import * as Core from "./core";
import * as d3 from "d3";
import musicTheory from "../const/music-theory.json";
import { groupBy, pipe, times } from "remeda";
import { MidiNoteNumber } from "./core/units";

export class Keyboard {
  svg: d3.Selection<SVGSVGElement, undefined, null, undefined> | null = null;
  constructor(public range: [MidiNoteNumber, MidiNoteNumber]) {}
  onNoteOn?: () => void;
  onNoteOff?: () => void;
  noteOn(note: Core.Note) {
    this.onNoteOn?.();
    this.svg
      ?.select(`rect[pitch="${note.pitch.value}"]`)
      .attr("class", "note-on");
  }
  noteOff(note: Core.Note) {
    this.onNoteOff?.();
    this.svg
      ?.select(`rect[pitch="${note.pitch.value}"]`)
      .attr("class", "note-off");
  }
  render() {
    const WHITE_KEY_WIDTH = 23.5;
    const WHITE_KEY_HEIGHT = 150;
    const BLACK_KEY_WIDTH = 13;
    const BLACK_KEY_HEIGHT = 100;
    const rangeDiff = (this.range[1].value ?? 0) - (this.range[0].value ?? 0);
    const keys = times(rangeDiff, (i) => i + this.range[0].value);
    const groupedKeys = pipe(
      keys,
      groupBy((pitch) =>
        musicTheory.accidentalPitchClasses.includes(
          (pitch % musicTheory.pitchClasses.length) as 1 | 3 | 6 | 8 | 10
        )
          ? "black"
          : "white"
      )
    );
    this.svg ??= d3.create("svg");
    this.svg
      .attr("width", rangeDiff * WHITE_KEY_WIDTH)
      .append("g")
      .attr("transform", `translate(${BLACK_KEY_WIDTH}, ${0})`)
      .call((g) => {
        g.append("g")
          .attr("class", "whitekeys")
          .selectAll("rect")
          .data(groupedKeys.white ?? [])
          .join("rect")
          .attr("pitch", (key) => key)
          .attr("x", (_, i) => i * WHITE_KEY_WIDTH)
          .attr("width", WHITE_KEY_WIDTH)
          .attr("height", WHITE_KEY_HEIGHT)
          .attr("fill", "white")
          .attr("stroke", "black")
          .attr("stroke-width", 1)
          .on("click", function (_, note) {
            console.log({ note });
          })
          .on("pointerdown", (_, note) => {
            this.noteOn(
              new Core.Note({
                id: 0,
                trackId: 0,
                velocity: 100,
                pitch: new MidiNoteNumber(note),
              })
            );
          })
          .on("pointerup", (_, note) => {
            this.noteOff(
              new Core.Note({
                id: 0,
                trackId: 0,
                velocity: 100,
                pitch: new MidiNoteNumber(note),
              })
            );
          });
        g.append("g")
          .attr(
            "transform",
            `translate(${-(WHITE_KEY_WIDTH + BLACK_KEY_WIDTH / 2)}, ${0})`
          )
          .attr("class", "blackkeys")
          .selectAll("rect")
          .data(groupedKeys.black ?? [])
          .join("rect")
          .attr("pitch", (key) => key)
          .attr(
            "x",
            (key, i) =>
              (keys.indexOf(key) - keys.indexOf(keys[i - 1])) * WHITE_KEY_WIDTH
          )
          .attr("width", BLACK_KEY_WIDTH)
          .attr("height", BLACK_KEY_HEIGHT)
          .attr("fill", "black")
          .on("click", function (_, note) {
            console.log({ note });
          })
          .on("pointerdown", (_, note) => {
            this.noteOn(
              new Core.Note({
                id: 0,
                trackId: 0,
                velocity: 100,
                pitch: new MidiNoteNumber(note),
              })
            );
          })
          .on("pointerup", (_, note) => {
            this.noteOff(
              new Core.Note({
                id: 0,
                trackId: 0,
                velocity: 100,
                pitch: new MidiNoteNumber(note),
              })
            );
          });
      });
    return this.svg.node();
  }
}
