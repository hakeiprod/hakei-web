import * as Core from "@/s-core/models/core";
import * as Audio from "@/s-core/models/audio";
import * as BrowserAudio from "@/s-core/models/browser/audio";
import { pipe, filter, find } from "remeda";
import { match } from "ts-pattern";
import { Keyboard } from "./keyboard";
import { JudgeType } from "../rythme/enums/judge";
import { Application, Container, Graphics } from "pixi.js";
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
    public soundfont2: Soundfont2
  ) {
    this.rythme = this.audio.toRythme();
    this.keyboard = new Keyboard();
    this.audioController = new BrowserAudio.Controller(
      audio.toAudio(),
      soundfont2
    );
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
    const graphics = this.pixiRootContainer.getChildByLabel(
      rythmeNote.searchParamsLabel.toString()
    ) as Graphics | null;
    if (!graphics) return;
    const { x, y, width, height } = graphics.getLocalBounds();
    graphics
      .clear()
      .roundRect(x, y, width, height, RythmeGame.NOTE_RECT_ROUNDED)
      .setFillStyle(
        match(rythmeNote.judge)
          .with(JudgeType.Perfect as 0, () => "blue")
          .with(JudgeType.Good as 1, () => "yellow")
          .with(JudgeType.Miss as 2, () => "red")
          .exhaustive()
      )
      .fill();
  }
  async render() {
    const application = new Application();
    await application.init({ background: "dimgray", resizeTo: window });

    this.keyboard.range = this.rythme.pitchRange;
    new KeyeventConnecter(this.keyboard);
    new MidiinputConnecter(this.keyboard);
    this.keyboard.render();

    const FallingNoteHeight =
      application.renderer.height - this.keyboard.container.height;

    for (const note of this.rythme.notes) {
      const graphicsRectHeight =
        note.duration.toSeconds(note.tempo.value) * RythmeGame.SCROLL_SPEED;
      this.pixiRootContainer.addChild(
        new Graphics({
          label: note.searchParamsLabel.toString(),
        })
          .roundRect(
            (this.keyboard.groupedRnageKeys.white?.indexOf(note.pitch.value) ??
              -1) * Keyboard.WHITE_KEY_WIDTH,
            -graphicsRectHeight,
            Keyboard.WHITE_KEY_WIDTH,
            graphicsRectHeight,
            RythmeGame.NOTE_RECT_ROUNDED
          )
          .setFillStyle({ color: "skyblue" })
          .fill()
      );
    }
    application.ticker.add(() => {
      for (const child of this.pixiRootContainer.children) {
        const searchParams = new URLSearchParams(child.label);
        if (searchParams.get("type") === "note") {
          const graphics = child as Graphics;
          const note = this.rythme.notes.find(
            (note) =>
              note.trackId.toString() === searchParams.get("trackId") &&
              note.id.toString() === searchParams.get("id")
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
    this.pixiRootContainer.addChild(this.keyboard.container);
    application.stage.addChild(this.pixiRootContainer);
    return application.canvas;
  }
  start() {
    this.audioController.play();
  }
  pause() {}
  end() {}
}
