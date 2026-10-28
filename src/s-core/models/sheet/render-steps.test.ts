import { expect, test } from "vitest";
import { drainSteps } from "./render-steps";

test("synchronous drain preserves order and return value", () => {
  const order: number[] = [];
  function* build() {
    for (let index = 0; index < 5; index++) {
      order.push(index);
      yield;
    }
    return { order: [...order] };
  }
  expect(drainSteps(build())).toEqual({ order: [0, 1, 2, 3, 4] });
});

test("synchronous errors propagate and release iterator-owned state", () => {
  let released = false;
  function* build() {
    try {
      yield;
      throw new Error("step failed");
    } finally {
      released = true;
    }
  }
  expect(() => drainSteps(build())).toThrow("step failed");
  expect(released).toBe(true);
});

test("incremental sorting retains the native stable comparator order and leaves input unchanged", async () => {
  const { sortSteps } = await import("./render-steps");
  const values = Array.from({ length: 137 }, (_, index) => ({
    index,
    key: (index * 13) % 9,
  }));
  const before = [...values],
    compare = (a: (typeof values)[number], b: (typeof values)[number]) =>
      a.key - b.key;
  expect(drainSteps(sortSteps(values, compare))).toEqual(
    values.toSorted(compare),
  );
  expect(values).toEqual(before);
});
