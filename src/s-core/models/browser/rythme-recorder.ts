import * as Sheet from "@/s-core/models/sheet";
import * as BrowserAudio from "@/s-core/models/browser/audio";
import { MidiNoteNumber } from "../core/units";
import { pipe, filter, find } from "remeda";
import { match } from "ts-pattern";

export class RythmeRecorder {
  rythme;
  constructor(
    public sheet: Sheet.Score,
    public controller: BrowserAudio.Controller
  ) {
    this.rythme = this.sheet.toRythme();
    controller.onPlayEnd = () => console.log(this.rythme);
  }
  start() {
    const startTime = this.controller.audioContext.currentTime;
    window.addEventListener("keydown", (e) => {
      const time = startTime - this.controller.audioContext.currentTime;
      const note = pipe(
        this.rythme.notes,
        filter(
          (note) =>
            !note.isHitted &&
            note.pitch.equal(
              new MidiNoteNumber(
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
                  .run()
              )
            )
        ),
        find((note) => note.isHit(time))
      );
      if (note) {
        note.hitTime = time;
        console.log("judge", note.judge);
      }
    });
    this.controller.play();
  }
  pause() {}
  end() {}
}
