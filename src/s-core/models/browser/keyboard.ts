import { Container, Graphics } from "pixi.js";
import { groupBy, pipe, times } from "remeda";
import musicTheory from "../../const/music-theory.json";
import * as Core from "../core";
import { MidiNoteNumber } from "../core/units";

export class Keyboard {
  static WHITE_KEY_WIDTH = 23.5;
  static WHITE_KEY_HEIGHT = 150;
  static BLACK_KEY_WIDTH = 13;
  static BLACK_KEY_HEIGHT = 100;
  onNoteOn?: (note: Core.Note) => void;
  onNoteOff?: (note: Core.Note) => void;
  container = new Container();
  get rangeKeys() {
    return times(this.rangeSize, (index) => index + this.range[0].value);
  }
  get rangeSize() {
    return this.range[1].value - this.range[0].value;
  }
  get groupedRnageKeys() {
    return pipe(
      this.rangeKeys,
      groupBy((pitch) => (Keyboard.isBlackKey(pitch) ? "black" : "white"))
    );
  }
  constructor(
    public range: [MidiNoteNumber, MidiNoteNumber] = [
      new MidiNoteNumber(-1),
      new MidiNoteNumber(-1),
    ]
  ) {}
  noteOn(...arguments_: Parameters<NonNullable<typeof this.onNoteOn>>) {
    this.onNoteOn?.(...arguments_);
    const graphics = this.container.getChildByLabel(
      arguments_[0].pitch.value.toString()
    ) as Graphics | null;
    if (!graphics) return;
    const { x, y, width, height } = graphics.getLocalBounds();
    graphics.clear().rect(x, y, width, height).setFillStyle("red").fill();
  }
  noteOff(...arguments_: Parameters<NonNullable<typeof this.onNoteOff>>) {
    this.onNoteOff?.(...arguments_);
    const graphics = this.container.getChildByLabel(
      arguments_[0].pitch.value.toString()
    ) as Graphics | null;
    if (!graphics) return;
    const { x, y, width, height } = graphics.getLocalBounds();
    graphics
      .clear()
      .rect(x, y, width, height)
      .setFillStyle(
        Keyboard.isBlackKey(arguments_[0].pitch.value) ? "black" : "white"
      )
      .fill();
  }
  render() {
    for (const [index, whitekey] of Object.entries(
      this.groupedRnageKeys.white ?? []
    )) {
      const note = new Core.Note({
        id: 0,
        trackId: 0,
        velocity: 100,
        pitch: new MidiNoteNumber(whitekey),
      });
      this.container.addChild(
        new Graphics({
          label: whitekey.toString(),
          eventMode: "static",
        })
          .rect(
            Number(index) * Keyboard.WHITE_KEY_WIDTH,
            0,
            Keyboard.WHITE_KEY_WIDTH,
            Keyboard.WHITE_KEY_HEIGHT
          )
          .setFillStyle("white")
          .setStrokeStyle({ width: 1, color: "black" })
          .fill()
          .on("pointerdown", () => this.noteOn(note))
          .on("pointerup", () => this.noteOff(note))
      );
    }
    for (const [index, blackkey] of Object.entries(
      this.groupedRnageKeys.black ?? []
    )) {
      const note = new Core.Note({
        id: 0,
        trackId: 0,
        velocity: 100,
        pitch: new MidiNoteNumber(blackkey),
      });
      this.container.addChild(
        new Graphics({
          label: blackkey.toString(),
          eventMode: "static",
        })
          .rect(
            (this.rangeKeys.indexOf(blackkey) -
              this.rangeKeys.indexOf(this.rangeKeys[Number(index) - 1])) *
              Keyboard.WHITE_KEY_WIDTH -
              (Keyboard.WHITE_KEY_WIDTH + Keyboard.BLACK_KEY_WIDTH / 2),
            0,
            Keyboard.BLACK_KEY_WIDTH,
            Keyboard.BLACK_KEY_HEIGHT
          )
          .setFillStyle("black")
          .fill()
          .on("pointerdown", () => this.noteOn(note))
          .on("pointerup", () => this.noteOff(note))
      );
    }
    return this.container;
  }
  static isBlackKey(key: number) {
    return musicTheory.accidentalPitchClasses.includes(
      (key % musicTheory.pitchClasses.length) as 1 | 3 | 6 | 8 | 10
    );
  }
}
