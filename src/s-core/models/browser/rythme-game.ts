import * as Core from "@/s-core/models/core";
import * as Audio from "@/s-core/models/audio";
import * as Rythme from "@/s-core/models/rythme";
import * as BrowserAudio from "@/s-core/models/browser/audio";
import { pipe, filter, find, times } from "remeda";
import { match } from "ts-pattern";
import { Keyboard } from "./keyboard";
import { JudgeType } from "../rythme/enums/judge";
import { Application, Container, Graphics, Text } from "pixi.js";
import "pixi.js/advanced-blend-modes";
import Soundfont2 from "../files/soundfont2";
import { KeyeventConnecter } from "../keyboard_input/keyevent-connecter";
import { MidiinputConnecter } from "../keyboard_input/midiinput-connecter";

export class RythmeGame {
  rythme;
  keyboard;
  audioController;
  static SCROLL_SPEED = 100;
  static NOTE_RECT_ROUNDED = 5;
  private pixiRootContainer = new Container();
  constructor(
    public audio: Audio.Score,
    public soundfont2: Soundfont2,
    public fontFamily: string
  ) {
    this.rythme = Rythme.Score.import(this.audio.export());
    this.keyboard = new Keyboard();
    this.audioController = new BrowserAudio.Controller(audio, soundfont2);
    this.keyboard.onNoteOn = (note) => this.noteOn(note);
    this.audioController.onPlayEnd = () =>
      console.log(
        {
          perfect: this.rythme.notes.filter(
            (note) => note.judge === JudgeType.Perfect
          ).length,
          good: this.rythme.notes.filter(
            (note) => note.judge === JudgeType.Good
          ).length,
          miss: this.rythme.notes.filter(
            (note) => note.judge === JudgeType.Miss
          ).length,
        },
        this.rythme
      );
  }
  noteOn(note: Core.Note) {
    const time = this.audioController.elapsedTime;
    const rythmeNote = pipe(
      this.rythme.notes,
      filter(({ isHitted, pitch }) => !isHitted && pitch.equal(note.pitch)),
      find((note) => note.canHit(time))
    );
    if (!rythmeNote) return;
    rythmeNote.hitSeconds = time;
    const text = this.pixiRootContainer.getChildByLabel(
      rythmeNote.searchParamsLabel.toString()
    ) as Text | null;
    if (!text) return;
    text.style.fill = match(rythmeNote.judge)
      .with(JudgeType.Perfect as 0, () => "blue" as const)
      .with(JudgeType.Good as 1, () => "yellow" as const)
      .with(JudgeType.Miss as 2, () => "red" as const)
      .exhaustive();
    // const { x, y, width, height } = text.getLocalBounds();
    // graphics
    // .clear()
    // .roundRect(x, y, width, height, RythmeGame.NOTE_RECT_ROUNDED)
    // .setFillStyle(
    //   match(rythmeNote.judge)
    //     .with(JudgeType.Perfect as 0, () => "blue")
    //     .with(JudgeType.Good as 1, () => "yellow")
    //     .with(JudgeType.Miss as 2, () => "red")
    //     .exhaustive()
    // )
    // .fill();
  }
  async render() {
    const application = new Application();
    await application.init({
      background: "white",
      resizeTo: globalThis.window,
    });
    this.keyboard.range = this.rythme.keyRange;
    new KeyeventConnecter(this.keyboard);
    new MidiinputConnecter(this.keyboard);
    this.keyboard.render();

    const FallingNoteHeight =
      application.renderer.height - this.keyboard.container.height;

    for (const note of this.rythme.notes) {
      const graphicsRectHeight =
        note.duration.toSeconds(note.tempo.value) * RythmeGame.SCROLL_SPEED;
      this.pixiRootContainer.addChild(
        new Text({
          label: note.searchParamsLabel.toString(),
          text: String.fromCodePoint(note.noteheadGlyph.codepoint),
          style: {
            fontFamily: this.fontFamily,
            fontSize: 80,
            fill: "black",
          },
          x:
            (this.keyboard.groupedRnageKeys.white?.indexOf(note.pitch.value) ??
              -1) * Keyboard.WHITE_KEY_WIDTH,
          y: -graphicsRectHeight,
          anchor: { x: 0, y: 0.5 },
        })
        // new Graphics({
        //   label: note.searchParamsLabel.toString(),
        // })
        //   .roundRect(
        //     (this.keyboard.groupedRnageKeys.white?.indexOf(note.pitch.value) ??
        //       -1) * Keyboard.WHITE_KEY_WIDTH,
        //     -graphicsRectHeight,
        //     Keyboard.WHITE_KEY_WIDTH,
        //     graphicsRectHeight,
        //     RythmeGame.NOTE_RECT_ROUNDED
        //   )
        //   .setFillStyle({ color: "black" })
        //   .fill()
      );
    }
    application.ticker.add(() => {
      for (const child of this.pixiRootContainer.children) {
        const searchParameters = new URLSearchParams(child.label);
        if (searchParameters.get("type") === "note") {
          const graphics = child as Text;
          const note = this.rythme.notes.find(
            (note) =>
              note.trackId.toString() === searchParameters.get("trackId") &&
              note.id.toString() === searchParameters.get("id")
          );
          graphics.y =
            FallingNoteHeight -
            ((note?.start.toSeconds(note.tempo.value) ?? 0) -
              this.audioController.elapsedTime) *
              RythmeGame.SCROLL_SPEED;
        }
      }
    });
    this.keyboard.container.y = FallingNoteHeight;
    this.pixiRootContainer.x =
      application.renderer.width / 2 - this.pixiRootContainer.width / 2;
    // borders
    this.pixiRootContainer.addChild(
      ...times(
        (this.keyboard.groupedRnageKeys.white ?? []).length + 1,
        (index) =>
          new Graphics()
            .rect(
              index * Keyboard.WHITE_KEY_WIDTH,
              0,
              1,
              application.renderer.height
            )
            .setFillStyle("black")
            .fill()
      )
    );
    this.pixiRootContainer.addChild(this.keyboard.container);
    application.stage.addChild(this.pixiRootContainer);
    return application.canvas;
  }
  start() {
    this.audioController.setState(BrowserAudio.ControllerState.Playing);
  }
  pause() {}
  end() {}
}
