import { expect, test, vi } from "vitest";
import {
  beginScoreNavigation,
  subscribeScoreNavigation,
} from "./score-navigation";

test("keeps surfaces suspended until every pending navigation settles", () => {
  const listener = vi.fn();
  const unsubscribe = subscribeScoreNavigation(listener);
  const first = beginScoreNavigation();
  const second = beginScoreNavigation();
  first();
  expect(listener.mock.calls).toEqual([[false], [true]]);
  second();
  second();
  expect(listener.mock.calls).toEqual([[false], [true], [false]]);
  unsubscribe();
  const last = beginScoreNavigation();
  last();
  expect(listener).toHaveBeenCalledTimes(3);
});

test("a newly mounted surface observes a navigation already in progress", () => {
  const finish = beginScoreNavigation();
  const listener = vi.fn();
  const unsubscribe = subscribeScoreNavigation(listener);
  expect(listener).toHaveBeenLastCalledWith(true);
  finish();
  expect(listener).toHaveBeenLastCalledWith(false);
  unsubscribe();
});
