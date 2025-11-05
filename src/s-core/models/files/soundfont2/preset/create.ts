import Preset from ".";
import Soundfont2 from "..";
import Metadata from "../metadata.json";
import { Generator } from "../generator";
import Instrument from "../instrument";

export function create(soundfont2: Soundfont2, presetNumber: number) {
  const headerI = soundfont2.phdr.findIndex(
    (data) => data.preset === presetNumber
  );
  const header = soundfont2.phdr[headerI]!;
  const nextHeader = soundfont2.phdr[headerI + 1];
  const bags = soundfont2.pbag
    .slice(header.bagIndex, nextHeader?.bagIndex)
    .map((bag, index) => ({
      data: bag,
      index: header.bagIndex + index,
    }));
  const globalGenerators: Generator[] = [];
  const instruments: Instrument[] = [];
  const preset = new Preset(
    soundfont2,
    presetNumber,
    header,
    bags.map((b) => b.data),
    globalGenerators,
    instruments
  );
  for (const bag of bags) {
    const generators = soundfont2.pgen.slice(
      bag.data.genIndex,
      soundfont2.pbag[bag.index + 1]?.genIndex
    );
    const modulators = soundfont2.pmod.slice(
      bag.data.modIndex,
      soundfont2.pbag[bag.index + 1]?.modIndex
    );
    if (generators.some((generator) => isInstrument(generator))) {
      for (const gen of generators)
        if (isInstrument(gen))
          instruments.push(Instrument.create(preset, generators, modulators));
    } else globalGenerators.push(...generators);
  }
  return preset;
}
function isInstrument(generator: Generator) {
  return generator.genOper === Metadata.generators[41]?.name;
}
