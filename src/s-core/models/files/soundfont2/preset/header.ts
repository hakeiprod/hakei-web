export class Header {
  name;
  bagIndex;
  preset;
  bank;
  library;
  genre;
  morphology;
  constructor({
    name,
    bagIndex,
    preset,
    bank,
    library,
    genre,
    morphology,
  }: {
    name: string;
    bagIndex: number;
    preset: number;
    bank: number;
    library: number;
    genre: number;
    morphology: number;
  }) {
    this.name = name;
    this.bagIndex = bagIndex;
    this.preset = preset;
    this.bank = bank;
    this.library = library;
    this.genre = genre;
    this.morphology = morphology;
  }
}
