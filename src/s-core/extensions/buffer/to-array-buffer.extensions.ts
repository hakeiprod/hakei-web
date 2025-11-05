export {};
declare global {
  interface Buffer {
    toArrayBuffer: () => ArrayBuffer;
  }
}
Buffer.prototype.toArrayBuffer = function () {
  console.log(this.buffer);
  return this.buffer.slice(this.byteOffset, this.byteOffset + this.byteLength);
};
