export class Header {
  name;
  bagIndex;
  constructor({ name, bagIndex }: { name: string; bagIndex: number }) {
    this.name = name;
    this.bagIndex = bagIndex;
  }
}
