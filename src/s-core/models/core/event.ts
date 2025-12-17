import { entries, mapToObj, pipe } from "remeda";
import { Beat } from "./units/beat";

export class Event {
  _start;
  _duration;
  _end;
  get start(): Beat {
    return this._start ?? this.end.subtract(this.duration);
  }
  get duration(): Beat {
    return this._duration ?? this.end.subtract(this.start);
  }
  get end(): Beat {
    return this._end ?? this.start.add(this.duration);
  }
  constructor({
    start,
    duration,
    end,
  }: {
    start?: Beat;
    duration?: Beat;
    end?: Beat;
  }) {
    this._start = start;
    this._duration = duration;
    this._end = end;
  }
  serialize() {
    return {
      start: this.start.value,
      duration: this.duration.value,
      end: this.end.value,
    };
  }
  export() {
    return this.serialize();
  }
  static import(data: ReturnType<Event["export"]>) {
    return new Event(
      pipe(
        data,
        entries(),
        mapToObj(([key, value]) => [key, new Beat(value)])
      )
    );
  }
  setEnd(end: Beat) {
    this._end = end;
    if (this._start) this._duration = this._end.subtract(this._start);
  }
  isOverflow(event: Event) {
    return (
      this.start.value < event.start.value || this.end.value > event.end.value
    );
  }
  isOverlapped(event: Event) {
    return (
      this.start.value < event.end.value && this.end.value > event.start.value
    );
  }
}
