import { Cent } from "../units/cent";
import { Hertz } from "../units/hertz";

export class Header {
  name;
  start;
  end;
  startLoop;
  endLoop;
  sampleRate;
  originalKey;
  correction;
  sampleLink;
  type;
  constructor({
    name,
    start,
    end,
    endLoop,
    startLoop,
    sampleRate,
    originalKey,
    correction,
    sampleLink,
    type,
  }: {
    name: string;
    start: number;
    end: number;
    startLoop: number;
    endLoop: number;
    sampleRate: number;
    originalKey: number;
    correction: number;
    sampleLink: number;
    type: number;
  }) {
    this.name = name;
    this.start = start;
    this.end = end;
    this.endLoop = endLoop;
    this.startLoop = startLoop;
    this.sampleRate = new Hertz(sampleRate);
    this.originalKey = originalKey;
    this.correction = new Cent(correction);
    this.sampleLink = sampleLink;
    this.type = type;
  }
}
