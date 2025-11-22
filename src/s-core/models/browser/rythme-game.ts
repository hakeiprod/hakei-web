import * as Core from "@/s-core/models/core";
import * as Sheet from "@/s-core/models/sheet";
import * as BrowserAudio from "@/s-core/models/browser/audio";
import { MidiNoteNumber } from "../core/units";
import { pipe, filter, find } from "remeda";
import { match } from "ts-pattern";
import { Keyboard } from "./keyboard";
import { JudgeType } from "../rythme/enums/judge";
import { Application, Container, Graphics } from "pixi.js";

export class RythmeGame {
  rythme;
  keyboard;
  static SCROLL_SPEED = 100;
  static NOTE_RECT_ROUNDED = 5;
  private pixiRootContainer = new Container();
  constructor(
    public sheet: Sheet.Score,
    public controller: BrowserAudio.Controller
  ) {
    this.rythme = this.sheet.toRythme();
    this.keyboard = new Keyboard(sheet.pitchRange);
    this.keyboard.onNoteOn = (note) => this.noteOn(note);
    controller.onPlayEnd = () =>
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
    window.addEventListener("keydown", (e) => {
      this.keyboard.noteOn(
        new Core.Note({
          id: 0,
          trackId: 0,
          velocity: 100,
          pitch: new MidiNoteNumber(
            match(e.key)
              .with("d", () => 55)
              .with("r", () => 56)
              .with("f", () => 57)
              .with("t", () => 58)
              .with("g", () => 59)
              .with("h", () => 60)
              .with("u", () => 61)
              .with("j", () => 62)
              .with("i", () => 63)
              .with("k", () => 64)
              .with("l", () => 65)
              .with("p", () => 66)
              .with(";", () => 67)
              .with("@", () => 68)
              .with(":", () => 69)
              .with("[", () => 70)
              .with("]", () => 71)
              .otherwise(() => -1)
          ),
        })
      );
    });
    window.addEventListener("keyup", (e) => {
      this.keyboard.noteOff(
        new Core.Note({
          id: 0,
          trackId: 0,
          velocity: 100,
          pitch: new MidiNoteNumber(
            match(e.key)
              .with("d", () => 55)
              .with("r", () => 56)
              .with("f", () => 57)
              .with("t", () => 58)
              .with("g", () => 59)
              .with("h", () => 60)
              .with("u", () => 61)
              .with("j", () => 62)
              .with("i", () => 63)
              .with("k", () => 64)
              .with("l", () => 65)
              .with("p", () => 66)
              .with(";", () => 67)
              .with("@", () => 68)
              .with(":", () => 69)
              .with("[", () => 70)
              .with("]", () => 71)
              .otherwise(() => -1)
          ),
        })
      );
    });
  }
  noteOn(coreNote: Core.Note) {
    const time =
      this.controller.audioContext.currentTime - this.controller.startTime;
    const rythmeNote = pipe(
      this.rythme.notes,
      filter((note) => !note.isHitted && note.pitch.equal(coreNote.pitch)),
      find((note) => note.canHit(time))
    );
    if (rythmeNote) {
      rythmeNote.hitSeconds = time;

      const searchParams = new URLSearchParams();
      searchParams.append("type", "note");
      searchParams.append("id", rythmeNote.id.toString());
      searchParams.append("trackId", rythmeNote.trackId.toString());
      const graphics = this.pixiRootContainer.getChildByLabel(
        searchParams.toString()
      ) as Graphics | null;
      if (graphics) {
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
    }
  }
  async render() {
    const application = new Application();
    await application.init({ background: "black", resizeTo: window });
    const FallingNoteHeight =
      application.renderer.height - this.keyboard.container.height;

    for (const note of this.rythme.notes) {
      const searchParams = new URLSearchParams();
      searchParams.append("type", "note");
      searchParams.append("id", note.id.toString());
      searchParams.append("trackId", note.trackId.toString());
      const graphicsRectHeight =
        note.duration.toSeconds(note.tempo.value) * RythmeGame.SCROLL_SPEED;
      const graphics = new Graphics({ label: searchParams.toString() })
        .roundRect(
          (this.keyboard.groupedRnageKeys.white?.indexOf(note.pitch.value) ??
            -1) * Keyboard.WHITE_KEY_WIDTH,
          -graphicsRectHeight,
          Keyboard.WHITE_KEY_WIDTH,
          graphicsRectHeight,
          RythmeGame.NOTE_RECT_ROUNDED
        )
        .setFillStyle({ color: "skyblue" })
        .setStrokeStyle({ width: 5, color: "black", alignment: 0 })
        .fill();
      this.pixiRootContainer.addChild(graphics);
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
              (this.controller.audioContext.currentTime -
                this.controller.startTime)) *
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
    this.controller.play();
  }
  pause() {}
  end() {}
}
