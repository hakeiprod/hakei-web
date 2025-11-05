import Soundfont2 from ".";
import {
  bagParser,
  generatorParser,
  headerParser,
  instrumentParser,
  modulatorParser,
  sampleHeaderParser,
} from "./parser";
import Metadata from "./metadata.json";
import { Header as PresetHeader } from "./preset/header";
import { Header as InstrumentHeader } from "./instrument/header";
import { Header as SampleHeader } from "./sample/header";
import { Bag } from "./bag";
import { Modulator } from "./modulator";
import { Generator } from "./generator";
import Riff from "../riff";

export function create(arrayBuffer: ArrayBuffer) {
  const riff = Riff.create(arrayBuffer);
  const presetHeaderChunk = riff.getChunk(Metadata.id[0])!;
  const instrumentHeaderChunk = riff.getChunk(Metadata.id[4])!;
  const sampleHeaderChunk = riff.getChunk(Metadata.id[8])!;
  return new Soundfont2(
    headerParser(presetHeaderChunk.length)
      .parse(presetHeaderChunk.data)
      .data.map(
        (c: ConstructorParameters<typeof PresetHeader>[0]) =>
          new PresetHeader(c)
      ),
    parseBag(Metadata.id[1]).data.map(
      (c: ConstructorParameters<typeof Bag>[0]) => new Bag(c)
    ),
    parseModulator(Metadata.id[2]).data.map(
      (c: ConstructorParameters<typeof Modulator>[0]) => new Modulator(c)
    ),
    parseGenerator(Metadata.id[3]).data.map(
      (c: ConstructorParameters<typeof Generator>[0]) => new Generator(c)
    ),
    instrumentParser(instrumentHeaderChunk.length)
      .parse(instrumentHeaderChunk.data)
      .data.map(
        (c: ConstructorParameters<typeof InstrumentHeader>[0]) =>
          new InstrumentHeader(c)
      ),
    parseBag(Metadata.id[5]).data.map(
      (c: ConstructorParameters<typeof Bag>[0]) => new Bag(c)
    ),
    parseModulator(Metadata.id[6]).data.map(
      (c: ConstructorParameters<typeof Modulator>[0]) => new Modulator(c)
    ),
    parseGenerator(Metadata.id[7]).data.map(
      (c: ConstructorParameters<typeof Generator>[0]) => new Generator(c)
    ),
    sampleHeaderParser(sampleHeaderChunk.length)
      .parse(sampleHeaderChunk.data)
      .data.map(
        (c: ConstructorParameters<typeof SampleHeader>[0]) =>
          new SampleHeader(c)
      ),
    riff.getChunk(Metadata.id[9])!.data
  );
  function parseBag(id: Metadata["bag"][number]) {
    const chunk = riff.getChunk(id)!;
    return bagParser(chunk.length).parse(chunk.data);
  }
  function parseModulator(id: Metadata["mod"][number]) {
    const chunk = riff.getChunk(id)!;
    return modulatorParser(chunk.length).parse(chunk.data);
  }
  function parseGenerator(id: Metadata["gen"][number]) {
    const chunk = riff.getChunk(id)!;
    return generatorParser(chunk.length).parse(chunk.data);
  }
}
