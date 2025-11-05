import { Beat } from "./units/beat";

export class Event {
  #start;
  #duration;
  #end;
  get start(): Beat {
    return this.#start ?? this.end.subtract(this.duration);
  }
  get duration(): Beat {
    return this.#duration ?? this.end.subtract(this.start);
  }
  get end(): Beat {
    return this.#end ?? this.start.add(this.duration);
  }
  get params() {
    return {
      start: this.start.value,
      duration: this.duration.value,
      end: this.end.value,
    };
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
    this.#start = start;
    this.#duration = duration;
    this.#end = end;
  }
  setEnd(end: Beat) {
    this.#end = end;
    if (this.#start) this.#duration = this.#end.subtract(this.#start);
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
