import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { subscribeScoreNavigation } from "@/s-core/models/browser/score-navigation";
const status = vi.hoisted(() => ({ pending: false }));
vi.mock("next/link", () => ({ useLinkStatus: () => status }));
import { ScoreNavigationStatus } from "./score-navigation-status";
afterEach(() => {
  cleanup();
  status.pending = false;
});
test("releases only its own pending link when navigation settles or the link unmounts", () => {
  const listener = vi.fn();
  const unsubscribe = subscribeScoreNavigation(listener);
  const first = render(<ScoreNavigationStatus />);
  const second = render(<ScoreNavigationStatus />);
  act(() => {
    status.pending = true;
    first.rerender(<ScoreNavigationStatus />);
    second.rerender(<ScoreNavigationStatus />);
  });
  expect(listener).toHaveBeenLastCalledWith(true);
  first.unmount();
  expect(listener).toHaveBeenLastCalledWith(true);
  act(() => {
    status.pending = false;
    second.rerender(<ScoreNavigationStatus />);
  });
  expect(listener.mock.calls).toEqual([[false], [true], [false]]);
  unsubscribe();
});
