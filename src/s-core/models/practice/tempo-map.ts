import { z } from "zod";
import { Beat } from "../core/units/beat";
/** Integrates tempo segments without rounding before the practice origin is subtracted. */
export class TempoMap {
  private readonly starts: number[];
  private readonly rates: number[];
  private readonly offsets: number[];
  constructor(
    raw: readonly { start: number; value: number }[],
    tempoScale: number,
  ) {
    z.number().finite().positive().parse(tempoScale);
    const tempos = z
      .array(
        z.object({
          start: z.number().finite().nonnegative(),
          value: z.number().finite().positive(),
        }),
      )
      .min(1)
      .parse(raw)
      .toSorted((a, b) => a.start - b.start);
    if (
      tempos[0].start !== 0 ||
      new Set(tempos.map((tempo) => tempo.start)).size !== tempos.length
    )
      throw new Error("INVALID_TEMPO_MAP");
    const rates = tempos.map(
      (tempo) => 60_000_000 / (tempo.value * tempoScale),
    );
    const offsets = [0];
    for (let index = 1; index < tempos.length; index++)
      offsets.push(
        offsets[index - 1] +
          (tempos[index].start - tempos[index - 1].start) * rates[index - 1],
      );
    this.starts = tempos.map((tempo) => tempo.start);
    this.rates = rates;
    this.offsets = offsets;
  }
  microsecondsAt(position: Beat) {
    const beat = position.value;
    z.number().finite().nonnegative().parse(beat);
    let low = 0;
    let high = this.starts.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (this.starts[middle] <= beat) low = middle + 1;
      else high = middle;
    }
    const index = low - 1;
    const total =
      this.offsets[index] + (beat - this.starts[index]) * this.rates[index];
    if (!Number.isFinite(total) || Math.abs(total) > Number.MAX_SAFE_INTEGER)
      throw new Error("TIMELINE_LIMIT");
    return total;
  }
}
