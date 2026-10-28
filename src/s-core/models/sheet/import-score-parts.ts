import type * as Sheet from ".";
import type { Tempo as CoreTempo } from "../core/tempo";
import type { RenderSteps } from "./render-steps";

type Data = ReturnType<Sheet.Score["export"]>;
function* importItems<Input, Output>(
  values: readonly Input[],
  create: (value: Input) => Output,
): RenderSteps<Output[]> {
  const result: Output[] = [];
  for (const value of values) {
    result.push(create(value));
    yield;
  }
  return result;
}

/** Both model families use the same ordering and their existing validating importers. */
export function* importScorePartsSteps<
  Note extends Sheet.Note,
  Track extends Sheet.Track,
  Stave extends Sheet.Stave,
  Bar extends Sheet.Bar,
  Masterbar extends Sheet.Masterbar,
  Chord extends Sheet.Chord,
  Timesignature extends Sheet.Timesignature,
  Keysignature extends Sheet.Keysignature,
  Tempo extends CoreTempo,
>(
  data: Data,
  factories: {
    note: (value: Data["notes"][number]) => Note;
    track: (value: Data["tracks"][number]) => Track;
    stave: (value: Data["staves"][number]) => Stave;
    bar: (value: Data["bars"][number]) => Bar;
    masterbar: (value: Data["masterbars"][number]) => Masterbar;
    chord: (value: Data["chords"][number]) => Chord;
    timesignature: (value: Data["timesignatures"][number]) => Timesignature;
    keysignature: (value: Data["keysignatures"][number]) => Keysignature;
    tempo: (value: Data["tempos"][number]) => Tempo;
  },
) {
  const notes = yield* importItems(data.notes, factories.note);
  const tracks = yield* importItems(data.tracks, factories.track);
  const timesignatures = yield* importItems(
    data.timesignatures,
    factories.timesignature,
  );
  const keysignatures = yield* importItems(
    data.keysignatures,
    factories.keysignature,
  );
  const tempos = yield* importItems(data.tempos, factories.tempo);
  const bars = yield* importItems(data.bars, factories.bar);
  const staves = yield* importItems(data.staves, factories.stave);
  const masterbars = yield* importItems(data.masterbars, factories.masterbar);
  const chords = yield* importItems(data.chords, factories.chord);
  return {
    notes,
    tracks,
    timesignatures,
    keysignatures,
    tempos,
    bars,
    staves,
    masterbars,
    chords,
  };
}
