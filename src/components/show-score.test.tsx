import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import * as Core from "@/s-core/models/core";
vi.mock("next/font/local", () => ({
  default: () => ({ className: "bravura", style: { fontFamily: "Bravura" } }),
}));
vi.mock("./score-viewer", () => ({
  ScoreViewer: ({
    score,
  }: {
    score: { notes: { pitch: { value: number }; rest: boolean }[] };
  }) => (
    <div data-testid="notes">
      {score.notes
        .filter((note) => !note.rest)
        .map((note) => note.pitch?.value ?? "unpitched")
        .join(",")}
    </div>
  ),
}));
vi.mock("./score-mixier", () => ({ ScoreMixier: () => null }));
vi.mock("./virtual-keyboard", () => ({ VirtualKeyboard: () => null }));
import { ShowScore } from "./show-score";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
test("empty and invalid score data have explicit states", () => {
  const view = render(
    <ShowScore
      score={{
        data: {
          notes: [],
          tracks: [],
          timesignatures: [],
          keysignatures: [],
          tempos: [],
          bars: [],
          masterbars: [],
          staves: [],
          chords: [],
          slots: [],
          rows: [],
        },
      }}
    />,
  );
  expect(screen.getByText("この楽譜には音符がありません。")).toBeDefined();
  view.rerender(<ShowScore score={{ data: { notes: [] } }} />);
  expect(screen.getByRole("alert").textContent).toContain("修正が必要");
});
test("viewing preserves fixture pitches and needs no MIDI access", () => {
  const midi = vi.fn();
  vi.stubGlobal("navigator", { requestMIDIAccess: midi });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  const exported = Core.Score.create({
    tracks: [
      {
        notes: [
          { pitch: 60, start: 0, duration: 1 },
          { pitch: 64, start: 1, duration: 1 },
        ],
      },
    ],
  })
    .toSheet()
    .export();
  // The viewer receives JSON read from Git, not live Beat instances in an export.
  // eslint-disable-next-line unicorn/prefer-structured-clone
  const data = JSON.parse(JSON.stringify(exported));
  const original = structuredClone(data);
  render(<ShowScore score={{ data, revisionNumber: 2 }} />);
  expect(screen.getByTestId("notes").textContent).toBe("60,64");
  expect(screen.getByText("版 2")).toBeDefined();
  expect(data).toEqual(original);
  expect(midi).not.toHaveBeenCalled();
});

test("unpitched percussion displays without constructing audio or fetching a soundfont", async () => {
  const { readFile } = await import("node:fs/promises");
  const { convertScore } = await import("@/s-core/models/import/convert");
  const result = await convertScore({
    bytes: await readFile("src/s-core/fixtures/tab-drum/drums/snare.musicxml"),
    options: { mode: "PRESERVE" },
  });
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(<ShowScore score={{ data: result.candidate }} />);
  expect(screen.getByTestId("notes").textContent).toContain("unpitched");
  expect(fetcher).not.toHaveBeenCalled();
  expect(screen.getByText(/打楽器譜は表示できます/)).toBeTruthy();
});
