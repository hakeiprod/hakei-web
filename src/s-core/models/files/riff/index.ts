import Metadata from "./metadata.json";
import { Parser } from "./parser";

interface Chunk {
  id: string;
  length: number;
  data: Uint8Array;
}

export default class Riff {
  constructor(public chunks: Chunk[]) {}
  getChunk(id: string) {
    return this.chunks.find((chunk) => chunk.id === id);
  }
  static ID = Metadata["id"];
  static create(arrayBuffer: ArrayBuffer) {
    return new Riff(
      (Parser.parse(new Uint8Array(arrayBuffer)) as { chunks: Chunk[] }).chunks
    );
  }
}
