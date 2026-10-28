import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import mitt from "mitt";
import type * as Audio from "@/s-core/models/audio";
import type * as BrowserAudio from "@/s-core/models/browser/audio";
import { ScorePlayer } from "./score-player";

afterEach(cleanup);
test("reports idle, play, pause, resume and stop without changing controller actions", () => {
  const controller = {
    play: vi.fn(), pause: vi.fn(), resume: vi.fn(), stop: vi.fn(),
    emitter: mitt(), isMute: false,
  };
  const onStateChange = vi.fn();
  render(<ScorePlayer score={{} as Audio.Score}
    controller={controller as unknown as BrowserAudio.Controller}
    onStateChange={onStateChange} />);
  expect(onStateChange).toHaveBeenLastCalledWith("idle");
  fireEvent.click(screen.getByRole("button", {name: "再生"}));
  expect(controller.play).toHaveBeenCalledOnce();
  expect(onStateChange).toHaveBeenLastCalledWith("playing");
  fireEvent.click(screen.getByRole("button", {name: "一時停止"}));
  expect(controller.pause).toHaveBeenCalledOnce();
  expect(onStateChange).toHaveBeenLastCalledWith("paused");
  fireEvent.click(screen.getByRole("button", {name: "再生"}));
  expect(controller.resume).toHaveBeenCalledOnce();
  expect(onStateChange).toHaveBeenLastCalledWith("playing");
  fireEvent.click(screen.getByRole("button", {name: "停止"}));
  expect(controller.stop).toHaveBeenCalledOnce();
  expect(onStateChange).toHaveBeenLastCalledWith("stopped");
});
