export {};
declare global {
  interface Int16Array {
    toFloat32Array: () => Float32Array;
  }
}
Int16Array.prototype.toFloat32Array = function () {
  const float32 = new Float32Array(this.length);
  for (let index = 0; index < this.length; index++)
    float32[index] = this[index] / 32_768;
  return float32;
};
