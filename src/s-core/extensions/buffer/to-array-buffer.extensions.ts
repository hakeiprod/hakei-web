export {};
declare global {
  interface Buffer {
    toArrayBuffer: () => ArrayBuffer;
  }
}
Buffer.prototype.toArrayBuffer = function () {
  return this.buffer.slice(this.byteOffset, this.byteOffset + this.byteLength);
};
