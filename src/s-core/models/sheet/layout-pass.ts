/** Geometry belongs to one layout pass and is invalidated before dependent edits. */
export class LayoutPass {
  private relations = new WeakMap<object, Map<string, unknown>>();
  relation<T>(owner: object, key: string, calculate: () => T): T {
    let values = this.relations.get(owner);
    if (values?.has(key)) return values.get(key) as T;
    const value = calculate();
    if (!values) {
      values = new Map();
      this.relations.set(owner, values);
    }
    values.set(key, value);
    return value;
  }
  private values = new WeakMap<object, Map<string, number>>();
  invalidate() {
    this.values = new WeakMap();
    this.relations = new WeakMap();
  }
  measure(owner: object, key: string, calculate: () => number): number {
    let values = this.values.get(owner);
    if (values?.has(key)) return values.get(key)!;
    const value = calculate();
    if (!values) {
      values = new Map();
      this.values.set(owner, values);
    }
    values.set(key, value);
    return value;
  }
}
export function measure(
  pass: LayoutPass | null,
  owner: object,
  key: string,
  calculate: () => number,
) {
  return pass ? pass.measure(owner, key, calculate) : calculate();
}
