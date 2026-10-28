/** A unit of pure model work. Browser scheduling belongs to the adapter. */
export type RenderSteps<Result> = Generator<void, Result, void>;

export function drainSteps<Result>(
  steps: Iterator<unknown, Result, void>,
): Result {
  let complete = false;
  try {
    while (true) {
      const step = steps.next();
      if (step.done) {
        complete = true;
        return step.value;
      }
    }
  } finally {
    if (!complete) steps.return?.();
  }
}

export function* mapSteps<Input, Output>(
  values: Iterable<Input>,
  create: (value: Input, index: number) => RenderSteps<Output>,
): RenderSteps<Output[]> {
  const result: Output[] = [];
  let index = 0;
  for (const value of values) {
    result.push(yield* create(value, index++));
    yield;
  }
  return result;
}

/** Stable merge order matches Array.toSorted, including comparator ties. */
export function* sortSteps<Value>(
  values: readonly Value[],
  compare: (a: Value, b: Value) => number,
): RenderSteps<Value[]> {
  let source = [...values],
    target = [...values];
  for (let width = 1; width < source.length; width *= 2) {
    for (let start = 0; start < source.length; start += width * 2) {
      const middle = Math.min(start + width, source.length),
        end = Math.min(start + width * 2, source.length);
      let left = start,
        right = middle;
      for (let position = start; position < end; position++) {
        target[position] =
          left < middle &&
          (right >= end || !(compare(source[left], source[right]) > 0))
            ? source[left++]
            : source[right++];
        yield;
      }
    }
    [source, target] = [target, source];
  }
  return source;
}
