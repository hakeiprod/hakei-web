import type { Keyboard } from "./keyboard";
import type { Note } from "../engraving/note";

/** Untimed pitch matching. Notes at the same beat form one practice step. */
export class PracticeSession {
  readonly steps: Note[][];
  private stepIndex = 0;
  private accepted = new Set<number>();
  private held = new Set<number>();
  private highlighted = new Set<Note>();
  onProgress?: (completed: number, total: number) => void;
  constructor(notes: readonly Note[]) {
    const steps = new Map<number, Note[]>();
    for (const note of notes
      .filter((note) => !note.rest)
      .toSorted((a, b) => a.start.value - b.start.value)) {
      const step = steps.get(note.start.value) ?? [];
      step.push(note);
      steps.set(note.start.value, step);
    }
    this.steps = [...steps.values()];
  }
  get completed() {
    return this.stepIndex;
  }
  get total() {
    return this.steps.length;
  }
  press(pitch: number) {
    if (this.held.has(pitch)) return false;
    this.held.add(pitch);
    const step = this.steps[this.stepIndex];
    if (!step || this.accepted.has(pitch)) return false;
    const matches = step.filter((note) => note.pitch.value === pitch);
    if (matches.length === 0) return false;
    this.accepted.add(pitch);
    for (const note of matches) {
      note.glyph.setClassName((classes) => [
        ...classes.filter((name) => name !== "note-highlight"),
        "note-highlight",
      ]);
      this.highlighted.add(note);
    }
    if (step.every((note) => this.accepted.has(note.pitch.value))) {
      this.stepIndex++;
      this.accepted.clear();
    }
    this.onProgress?.(this.completed, this.total);
    return true;
  }
  release(pitch: number) {
    this.held.delete(pitch);
  }
  bind(keyboard: Pick<Keyboard, "onNoteOn" | "onNoteOff">) {
    const previousOn = keyboard.onNoteOn;
    const previousOff = keyboard.onNoteOff;
    keyboard.onNoteOn = (note) => this.press(note.pitch.value);
    keyboard.onNoteOff = (note) => this.release(note.pitch.value);
    return () => {
      keyboard.onNoteOn = previousOn;
      keyboard.onNoteOff = previousOff;
      this.onProgress = undefined;
      this.reset();
    };
  }
  reset() {
    for (const note of this.highlighted)
      note.glyph.setClassName((classes) =>
        classes.filter((name) => name !== "note-highlight"),
      );
    this.highlighted.clear();
    this.held.clear();
    this.accepted.clear();
    this.stepIndex = 0;
    this.onProgress?.(this.completed, this.total);
  }
}
