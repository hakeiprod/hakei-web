import * as Core from "../core";
import * as d3 from "d3";
import musicTheory from "../../const/music-theory.json";
import { groupBy, pipe, times } from "remeda";
import { MidiNoteNumber } from "../core/units";
import { Container, Graphics } from "pixi.js";

export class Keyboard {
  static WHITE_KEY_WIDTH = 23.5;
  static WHITE_KEY_HEIGHT = 150;
  static BLACK_KEY_WIDTH = 13;
  static BLACK_KEY_HEIGHT = 100;
  onNoteOn?: (note: Core.Note) => void;
  onNoteOff?: (note: Core.Note) => void;
  svg: d3.Selection<SVGSVGElement, undefined, null, undefined> | null = null;
  container = new Container();
  get rangeKeys() {
    const rangeDiff = (this.range[1].value ?? 0) - (this.range[0].value ?? 0);
    return times(rangeDiff, (i) => i + this.range[0].value);
  }
  get rangeSize() {
    return (this.range[1].value ?? 0) - (this.range[0].value ?? 0);
  }
  get groupedRnageKeys() {
    return pipe(
      this.rangeKeys,
      groupBy((pitch) => (Keyboard.isBlackKey(pitch) ? "black" : "white"))
    );
  }
  constructor(public range: [MidiNoteNumber, MidiNoteNumber]) {}
  noteOn(...args: Parameters<NonNullable<typeof this.onNoteOn>>) {
    this.onNoteOn?.(...args);
    const graphics = this.container.getChildByLabel(
      args[0].pitch.value.toString()
    ) as Graphics | null;
    if (!graphics) return;
    const { x, y, width, height } = graphics.getLocalBounds();
    graphics.clear().rect(x, y, width, height).setFillStyle("red").fill();
  }
  noteOff(...args: Parameters<NonNullable<typeof this.onNoteOff>>) {
    this.onNoteOff?.(...args);
    const graphics = this.container.getChildByLabel(
      args[0].pitch.value.toString()
    ) as Graphics | null;
    if (!graphics) return;
    const { x, y, width, height } = graphics.getLocalBounds();
    graphics
      .clear()
      .rect(x, y, width, height)
      .setFillStyle(
        Keyboard.isBlackKey(args[0].pitch.value) ? "black" : "white"
      )
      .fill();
  }
  render() {
    for (const [i, whitekey] of Object.entries(
      this.groupedRnageKeys.white ?? []
    )) {
      const note = new Core.Note({
        id: 0,
        trackId: 0,
        velocity: 100,
        pitch: new MidiNoteNumber(whitekey),
      });
      const graphics = new Graphics()
        .rect(
          Number(i) * Keyboard.WHITE_KEY_WIDTH,
          0,
          Keyboard.WHITE_KEY_WIDTH,
          Keyboard.WHITE_KEY_HEIGHT
        )
        .setFillStyle({ color: "white" })
        .setStrokeStyle({ width: 1, color: "black" })
        .fill()
        .on("pointerdown", () => {
          this.noteOn(note);
        })
        .on("pointerup", () => {
          this.noteOff(note);
        });
      graphics.eventMode = "static";
      graphics.label = whitekey.toString();
      this.container.addChild(graphics);
    }
    for (const [i, blackkey] of Object.entries(
      this.groupedRnageKeys.black ?? []
    )) {
      const note = new Core.Note({
        id: 0,
        trackId: 0,
        velocity: 100,
        pitch: new MidiNoteNumber(blackkey),
      });
      const graphics = new Graphics()
        .rect(
          (this.rangeKeys.indexOf(blackkey) -
            this.rangeKeys.indexOf(this.rangeKeys[Number(i) - 1])) *
            Keyboard.WHITE_KEY_WIDTH -
            (Keyboard.WHITE_KEY_WIDTH + Keyboard.BLACK_KEY_WIDTH / 2),
          0,
          Keyboard.BLACK_KEY_WIDTH,
          Keyboard.BLACK_KEY_HEIGHT
        )
        .setFillStyle({ color: "black" })
        .fill()
        .on("pointerdown", () => {
          this.noteOn(note);
        })
        .on("pointerup", () => {
          this.noteOff(note);
        });
      graphics.eventMode = "static";
      graphics.label = blackkey.toString();
      this.container.addChild(graphics);
    }
    return this.container;
  }
  static isBlackKey(key: number) {
    return musicTheory.accidentalPitchClasses.includes(
      (key % musicTheory.pitchClasses.length) as 1 | 3 | 6 | 8 | 10
    );
  }
}
