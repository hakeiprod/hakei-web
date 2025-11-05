import { Modulator } from "../modulator";
import { Generator } from "../generator";
import { Sample } from ".";
import Metadata from "../metadata.json";
import Instrument from "../instrument";

import { match } from "ts-pattern";
import { Smpls32k } from "../units/32ksmpls";
import { Smpls } from "../units/smpls";
import { TCentKey } from "../units/tcentkey";
import { Centfs } from "../units/centfs";
import { Centibel } from "../units/centibel";
import { Centibelfs } from "../units/centibelfs";
import { Centibelattan } from "../units/centibelattan";
import { Timecent } from "../units/timecent";
import { Cent } from "../units/cent";
import { CentKey } from "../units/centkey";
import { MidiKey } from "../units/midikey";
import { MidiVel } from "../units/midivel";
import { BitFlag } from "../units/bitflag";
import { Semitone } from "../units/semitone";
import { Arbitrary } from "../units/arbitrary";
import { Promille } from "../units/promille";
import {
  isDeepEqual,
  isNot,
  pipe,
  filter,
  isNonNullish,
  reduce,
  isNumber,
} from "remeda";

export function create(
  instrument: Instrument,
  instrumentGenerators: Generator[],
  instrumentModulators: Modulator[]
) {
  const headerI = instrumentGenerators.find(
    (generator) => generator.genOper === Metadata.generators[53]?.name
  )!.genAmount as number;
  const header = instrument.preset.soundfont2.shdr[headerI]!;
  return new Sample(
    instrument,
    instrumentGenerators,
    instrumentModulators,
    header,
    setGenerators(),
    new Int16Array(
      new Uint8Array(
        instrument.preset.soundfont2.smpl.subarray(
          header.start * 2,
          header.end * 2
        )
      ).buffer
    )
  );
  function setGenerators() {
    return pipe(
      Metadata.generators,
      filter(isNot(isDeepEqual(Metadata.generators[41]))),
      filter(isNot(isDeepEqual(Metadata.generators[53]))),
      filter(isNot(isDeepEqual(Metadata.generators[60]))),
      filter(isNonNullish),
      reduce((accumulator, current) => {
        const zone = () => {
          const isGenOper = ({ genOper }: Generator) =>
            genOper === current.name;
          let value;
          // inst globalZone
          const globalInstrumentGenerator =
            instrument.globalGenerators.find(isGenOper);
          if (globalInstrumentGenerator)
            value = globalInstrumentGenerator.genAmount;

          // inst localZone
          const localInstrumentGenerator = instrumentGenerators.find(isGenOper);
          if (localInstrumentGenerator)
            value = localInstrumentGenerator.genAmount;
          // preset localZone
          const localPresetGenerator =
            instrument.presetGenerators.find(isGenOper);
          if (
            localPresetGenerator &&
            isNumber(localPresetGenerator.genAmount) &&
            isNumber(value)
          )
            value += localPresetGenerator.genAmount;
          else {
            const globalPresetGenerator =
              instrument.preset.globalGenerators.find(isGenOper);
            if (
              globalPresetGenerator &&
              isNumber(globalPresetGenerator.genAmount) &&
              isNumber(value)
            )
              value += globalPresetGenerator.genAmount;
          }
          return value ?? current.default;
        };

        // TODO: Metadata.generatorsに対してvalueを追加するだけでいいかも
        accumulator[current.name] = match(current.uint)
          .with("smpls", () => new Smpls(zone() as number))
          .with("32k smpls", () => new Smpls32k(zone() as number))
          .with("MIDI ky#", () => new MidiKey(zone() as number))
          .with("MIDI vel", () => new MidiVel(zone() as number))
          .with("MIDI ky# range", () => zone() as { lo: number; hi: number })
          .with("MIDI vel range", () => zone() as { lo: number; hi: number })
          .with("cent", () => new Cent(zone() as number))
          .with("cent fs", () => new Centfs(zone() as number))
          .with("tcent/key", () => new TCentKey(zone() as number))
          .with("cent/key", () => new CentKey(zone() as number))
          .with("BitFlags", () => new BitFlag(zone() as number))
          .with("arbitary#", () => new Arbitrary(zone() as number))
          .with("0.1%", () => new Promille(zone() as number))
          .with("-0.1%", () => new Promille(-zone() as number))
          .with("semitone", () => new Semitone(zone() as number))
          .with("cB", () => new Centibel(zone() as number))
          .with("cB fs", () => new Centibelfs(zone() as number))
          .with("cB attan", () => new Centibelattan(zone() as number))
          .with("timecent", () => new Timecent(zone() as number))
          .exhaustive();
        return accumulator;
      }, {} as Generators)
    );
  }
}

export type Generators = {
  [K in Metadata["generators"][0 | 1 | 2 | 3 | 45 | 50]["name"]]: Smpls;
} & {
  [K in Metadata["generators"][4 | 12]["name"]]: Smpls32k;
} & {
  [K in Metadata["generators"][43 | 46 | 58]["name"]]: MidiKey;
} & {
  [K in Metadata["generators"][44 | 47]["name"]]: MidiVel;
} & {
  [K in Metadata["generators"][43 | 44]["name"]]: {
    lo: number;
    hi: number;
  };
} & {
  [K in Metadata["generators"][8 | 22 | 24 | 52]["name"]]: Cent;
} & {
  [K in Metadata["generators"][5 | 6 | 7 | 10 | 11]["name"]]: Centfs;
} & {
  [K in Metadata["generators"][31 | 32 | 39 | 40]["name"]]: TCentKey;
} & {
  [K in Metadata["generators"][56]["name"]]: CentKey;
} & {
  [K in Metadata["generators"][54]["name"]]: BitFlag;
} & {
  [K in Metadata["generators"][57]["name"]]: Arbitrary;
} & {
  [K in Metadata["generators"][15 | 16 | 17 | 29]["name"]]: Promille;
} & {
  [K in Metadata["generators"][51]["name"]]: Semitone;
} & {
  [K in Metadata["generators"][9 | 13 | 48]["name"]]: Centibel;
} & {
  [K in Metadata["generators"][37]["name"]]: Centibelattan;
} & {
  [K in Metadata["generators"][
    | 21
    | 23
    | 25
    | 26
    | 27
    | 28
    | 30
    | 33
    | 34
    | 35
    | 36
    | 38]["name"]]: Timecent;
};
