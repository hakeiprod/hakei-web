import Instrument from ".";
import Metadata from "../metadata.json";
import { Modulator } from "../modulator";
import { Generator } from "../generator";

import { Sample } from "../sample";
import Preset from "../preset";

export function create(
  preset: Preset,
  presetGenerators: Generator[],
  presetModulators: Modulator[]
) {
  const headerI = presetGenerators.find(
    (generator) => generator.genOper === Metadata["generators"][41]?.name
  )!.genAmount as number;
  const header = preset.soundfont2.inst[headerI]!;
  const nextHeader = preset.soundfont2.inst[headerI + 1];
  const bags = preset.soundfont2.ibag
    .slice(header.bagIndex, nextHeader?.bagIndex)
    .map((bag, index) => ({
      data: bag,
      index: header.bagIndex + index,
    }));
  const globalGenerators: Generator[] = [];
  const samples: Sample[] = [];
  const instrument = new Instrument(
    preset,
    presetGenerators,
    presetModulators,
    header,
    bags.map((b) => b.data),
    globalGenerators,
    samples
  );
  for (const bag of bags) {
    const generators = preset.soundfont2.igen.slice(
      bag.data.genIndex,
      preset.soundfont2.ibag[bag.index + 1]?.genIndex
    );
    const modulators = preset.soundfont2.imod.slice(
      bag.data.modIndex,
      preset.soundfont2.ibag[bag.index + 1]?.modIndex
    );
    if (
      generators.some(
        (generator) => generator.genOper === Metadata["generators"][53]?.name
      )
    ) {
      for (const gen of generators)
        if (gen.genOper === Metadata["generators"][53]?.name)
          samples.push(Sample.create(instrument, generators, modulators));
    } else globalGenerators.push(...generators);
  }
  return instrument;
}
