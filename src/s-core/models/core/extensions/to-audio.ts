import * as Audio from "../../audio";
import * as Core from "../../core";
import { map, pipe, prop, reduce, times } from "remeda";

declare module ".." {
  interface Score {
    toAudio(): Audio.Score;
  }
}

Core.Score.prototype.toAudio = function (this) {
  const masterbars = pipe(
    this.timesignatures,
    reduce(
      (accumulator, current) => {
        accumulator.events.push(
          ...times(
            Math.ceil(current.duration.value / current.numerator),
            () => {
              const event = {
                start: accumulator.start,
                duration: current.numerator,
                end: accumulator.start + current.numerator,
              };
              accumulator.start += current.numerator;
              return event;
            }
          )
        );
        return accumulator;
      },
      {
        start: 0,
        events: [] as { start: number; duration: number; end: number }[],
      }
    ),
    prop("events"),
    map((event, id) => Audio.Masterbar.import({ id, ...event }))
  );
  return Audio.Score.import({
    ...this.export(),
    masterbars: masterbars.map((bar) => bar.export()),
    notes: this.notes.map((note) => ({
      ...note.export(),
      masterbarId: masterbars.find((masterbar) => note.isOverlapped(masterbar))!
        .id,
    })),
  });
};
