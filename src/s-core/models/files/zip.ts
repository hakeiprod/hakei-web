import JSZip from "jszip";

export class Zip {
  arrayBuffer;
  constructor(arrayBuffer: ArrayBuffer) {
    this.arrayBuffer = arrayBuffer;
  }
  async unzip(): Promise<JSZip> {
    return await new JSZip().loadAsync(this.arrayBuffer);
  }
}
