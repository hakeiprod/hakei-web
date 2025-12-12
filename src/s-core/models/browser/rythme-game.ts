import * as Audio from "@/s-core/models/audio";
import * as BrowserAudio from "@/s-core/models/browser/audio";
import * as Core from "@/s-core/models/core";
import * as Rythme from "@/s-core/models/rythme";
import { Application, Container, Graphics, Text } from "pixi.js";
import "pixi.js/advanced-blend-modes";
import { filter, find, pipe, times } from "remeda";
import { match } from "ts-pattern";
import Soundfont2 from "../files/soundfont2";
import { KeyeventConnecter } from "../keyboard_input/keyevent-connecter";
import { MidiinputConnecter } from "../keyboard_input/midiinput-connecter";
import { JudgeType } from "../rythme/enums/judge";
import { Keyboard } from "./keyboard";

export class RythmeGame {
  rythme;
  keyboard;
  audioController;
  static SCROLL_SPEED = 300;
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
    const text = this.pixiRootContainer.children.find(
      (child) => (child as TextWithNote).note.id === rythmeNote.id
    ) as TextWithNote;
    if (!text) return;
    text.style.fill = match(rythmeNote.judge)
      .with(JudgeType.Perfect as 0, () => "blue" as const)
      .with(JudgeType.Good as 1, () => "yellow" as const)
      .with(JudgeType.Miss as 2, () => "red" as const)
      .exhaustive();
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

    const notes = this.rythme.notes.map((note) => {
      const textWithNote = new TextWithNote({
        text: String.fromCodePoint(note.noteheadGlyph.codepoint),
        style: {
          fontFamily: this.fontFamily,
          fontSize: 80,
          fill: "black",
        },
        x:
          (this.keyboard.groupedRnageKeys.white?.indexOf(note.pitch.value) ??
            -1) * Keyboard.WHITE_KEY_WIDTH,
        y: -(
          note.duration.toSeconds(note.tempo.value) * RythmeGame.SCROLL_SPEED
        ),
        anchor: { x: 0, y: 0.5 },
      });
      textWithNote.note = note;
      this.pixiRootContainer.addChild(textWithNote);
      return textWithNote;
    });
    application.ticker.add(() => {
      for (const note of notes) {
        note.y =
          FallingNoteHeight -
          ((note.note?.start.toSeconds(note.note.tempo.value) ?? 0) -
            this.audioController.elapsedTime) *
            RythmeGame.SCROLL_SPEED;
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
  start(trackIds: number[]) {
    this.rythme.tracks = this.rythme.tracks.filter((track) =>
      trackIds.includes(track.id)
    );
    this.rythme.notes = this.rythme.notes.filter((note) =>
      trackIds.includes(note.trackId)
    );
    this.audioController.setState(BrowserAudio.ControllerState.Playing);
  }
  pause() {}
  end() {}
}

class TextWithNote extends Text {
  note!: Rythme.Note;
}
