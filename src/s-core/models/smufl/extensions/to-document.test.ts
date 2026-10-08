// @vitest-environment node
/// <reference types="vite/client" />
import { readFile } from "node:fs/promises";
import { Importer } from "../../browser/importer";
import type { Beam } from "../../../const/musicxml/4.0/musicxml";
import { describe, expect, test, vi } from "vitest";
import * as Core from "../../core";
import "../../core/extensions/to-sheet";
import * as Drawing from "../../document";
import { LayoutType } from "../../sheet";
import * as SMUFL from "..";
import { toDocument } from "./to-document";

const fixtures = import.meta.glob("../../../fixtures/core/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Parameters<typeof Core.Score.create>[0]>;

function prepare(data: Parameters<typeof Core.Score.create>[0]): SMUFL.Score {
  const score = SMUFL.Score.import(
    Core.Score.create(structuredClone(data)).toSheet().export(),
  );
  if (score.tracks.length > 0) {
    const controller = new SMUFL.Controller(score, {
      scale: 12,
      layoutType: LayoutType.Horizontal,
      debug: false,
      advanced: true,
    });
    controller.mount();
    controller.order();
  }
  return score;
}

function flatten(elements: readonly Drawing.Element[]): Drawing.Element[] {
  return elements.flatMap((element) => [
    element,
    ...(element instanceof Drawing.Group ? flatten(element.children) : []),
  ]);
}

function checkGeometry(element: Drawing.Element) {
  if (element instanceof Drawing.Glyph) {
    expect(Number.isInteger(element.codepoint)).toBe(true);
    expect(Object.values(element.position).every(Number.isFinite)).toBe(true);
    expect(Object.values(element.bounds).every(Number.isFinite)).toBe(true);
  } else if (element instanceof Drawing.Group) {
    expect(Object.values(element.position).every(Number.isFinite)).toBe(true);
  } else if (element instanceof Drawing.Line) {
    expect(Object.values(element.start).every(Number.isFinite)).toBe(true);
    expect(Object.values(element.end).every(Number.isFinite)).toBe(true);
    expect(element.strokeWidth).toBeGreaterThan(0);
  } else if (element instanceof Drawing.Rectangle) {
    expect(Object.values(element.bounds).every(Number.isFinite)).toBe(true);
  }
}

describe("SMUFL to Document", () => {
  test.each(Object.entries(fixtures))(
    "converts %s without a browser and produces finite geometry",
    (_name, data) => {
      const score = prepare(data);
      expect(typeof globalThis.window).toBe("undefined");
      const document = score.toDocument({ debug: true });
      expect(document).toBeInstanceOf(Drawing.Document);
      expect(document.pages).toHaveLength(1);
      const page = document.pages[0];
      expect(page.width).toBeGreaterThanOrEqual(0);
      expect(page.height).toBeGreaterThanOrEqual(0);
      const elements = flatten(page.elements);
      for (const element of elements) checkGeometry(element);
      expect(
        elements.filter((element) => element.role === "note"),
      ).toHaveLength(score.notes.length);
    },
  );

  test("retains note identity and renders staff lines, stems and final barlines", () => {
    const score = prepare({
      tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
    });
    const elements = flatten(toDocument(score).pages[0].elements);
    const note = elements.find(
      (element) => element.role === "note" && element.source?.noteId === 0,
    ) as Drawing.Group;
    const glyph = note.children[0] as Drawing.Glyph;
    expect(glyph.codepoint).toBe(0xe0_a4);
    expect(glyph.position.y).toBe(5);
    expect(glyph.source).toMatchObject({
      rowId: 0,
      barId: 0,
      trackId: 0,
      staveId: 0,
      chordId: 0,
      noteId: 0,
    });
    expect(
      elements.filter((element) => element.role === "staff-line"),
    ).toHaveLength(5);
    expect(elements.some((element) => element.role === "stem")).toBe(true);
    expect(
      elements.some((element) => element.role === "barline-end-thick"),
    ).toBe(true);
  });

  test("copies glyphs and classes without modifying callbacks or the score", () => {
    const score = prepare({
      tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1.5 }] }],
    });
    const original = score.notes[0].glyph;
    original.setClassName(["selected"]);
    const callback = vi.fn();
    original.onClassListChange = callback;
    const before = JSON.stringify(score.export());
    const first = score.toDocument();
    const second = score.toDocument();
    expect(first).toEqual(second);
    expect(JSON.stringify(score.export())).toBe(before);
    expect(original.onClassListChange).toBe(callback);
    expect(callback).not.toHaveBeenCalled();
    const glyph = flatten(first.pages[0].elements).find(
      (element) =>
        element instanceof Drawing.Glyph && element.source?.noteId === 0,
    ) as Drawing.Glyph;
    expect(glyph.classList).toEqual(["selected"]);
    const snapshot = JSON.stringify(first);
    original.x = 100;
    original.classList.push("changed");
    expect(JSON.stringify(first)).toBe(snapshot);
    expect(
      flatten(first.pages[0].elements).filter(
        (element) =>
          element instanceof Drawing.Glyph &&
          element.glyphName === "augmentationDot" &&
          element.source?.noteId === 0,
      ),
    ).toHaveLength(1);
  });

  test("keeps row translations separate from glyph positions", () => {
    const score = prepare({
      tracks: [
        {
          notes: [
            { pitch: 60, start: 0, duration: 1 },
            { pitch: 64, start: 4, duration: 1 },
          ],
        },
      ],
    });
    for (const [id, bar] of score.masterbars.entries()) bar.rowId = id;
    score.rows = score.masterbars.map((bar, id) => {
      const row = new SMUFL.Row({ id });
      row.score = score;
      return row;
    });
    const document = score.toDocument();
    const rows = document.pages[0].elements as Drawing.Group[];
    expect(rows).toHaveLength(2);
    expect(rows[0].position).toEqual({ x: 0, y: 0 });
    expect(rows[1].position.y).toBeGreaterThan(0);
    expect(rows[1].source).toEqual({ rowId: 1 });
    expect((rows[1].children[0] as Drawing.Group).position.x).toBe(0);
  });

  test("converts MusicXML beams and stems to finite lines", async () => {
    const logging = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const data = await readFile(
        new URL(
          "../../../fixtures/files/musicxml/beat_8th.mxl",
          import.meta.url,
        ),
      );
      const sheet = await new Importer().import(
        new File([new Uint8Array(data)], "beat_8th.mxl"),
      );
      const score = SMUFL.Score.import(sheet.export());
      const controller = new SMUFL.Controller(score, {
        scale: 12,
        layoutType: LayoutType.Horizontal,
        debug: false,
        advanced: true,
      });
      controller.mount();
      controller.order();
      const elements = flatten(score.toDocument().pages[0].elements);
      expect(elements.some((element) => element.role === "beam")).toBe(true);
      for (const element of elements) checkGeometry(element);
    } finally {
      logging.mockRestore();
    }
  });

  test("debug bounds are optional", () => {
    const score = prepare({
      tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
    });
    expect(
      flatten(score.toDocument().pages[0].elements).some(
        (element) => element instanceof Drawing.Rectangle,
      ),
    ).toBe(false);
    expect(
      flatten(score.toDocument({ debug: true }).pages[0].elements).some(
        (element) => element instanceof Drawing.Rectangle,
      ),
    ).toBe(true);
  });

  test("rejects scores whose layout has not been initialized", () => {
    const score = SMUFL.Score.import(
      Core.Score.create({
        tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
      })
        .toSheet()
        .export(),
    );
    expect(() => score.toDocument()).toThrow("laid out score");
  });
});

function drawingLines(score: SMUFL.Score) {
  const lines: {
    line: Drawing.Line;
    start: Drawing.Point;
    end: Drawing.Point;
  }[] = [];
  function visit(elements: readonly Drawing.Element[], origin: Drawing.Point) {
    for (const element of elements) {
      if (element instanceof Drawing.Group)
        visit(element.children, {
          x: origin.x + element.position.x,
          y: origin.y + element.position.y,
        });
      else if (element instanceof Drawing.Line)
        lines.push({
          line: element,
          start: {
            x: origin.x + element.start.x,
            y: origin.y + element.start.y,
          },
          end: { x: origin.x + element.end.x, y: origin.y + element.end.y },
        });
    }
  }
  visit(score.toDocument().pages[0].elements, { x: 0, y: 0 });
  return lines;
}

function beam(value: Beam["_"], level: number): Beam {
  // The generated schema uses number & string, while the importer returns numeric levels.
  return { _: value, $: { number: level as number & string } };
}

function beamedScore(direction: "up" | "down", levels: number) {
  const duration = levels === 1 ? 0.5 : 0.25;
  const original = prepare({
    tracks: [
      {
        notes: [60, 64, 62].map((pitch, index) => ({
          pitch,
          start: index * duration,
          duration,
        })),
      },
    ],
  });
  const data = original.export();
  const notes = data.notes.filter((note) => !note.rest);
  for (const [index, note] of notes.entries()) {
    const value =
      index === 0 ? "begin" : index === notes.length - 1 ? "end" : "continue";
    note.stem = { _: direction };
    note.beam =
      levels === 1 ? [beam(value, 1)] : [beam(value, 1), beam(value, 2)];
  }
  const score = SMUFL.Score.import(data);
  const controller = new SMUFL.Controller(score, {
    scale: 12,
    layoutType: LayoutType.Horizontal,
    debug: false,
    advanced: true,
  });
  controller.mount();
  controller.order();
  return score;
}

describe("SMUFL anchor geometry", () => {
  test.each(["up", "down"] as const)(
    "attaches %s stems using the glyph anchor and stroke width",
    (direction) => {
      const score = prepare({
        tracks: [{ notes: [{ pitch: 60, start: 0, duration: 2 }] }],
      });
      score.notes[0].stem = { _: direction };
      const elements = flatten(score.toDocument().pages[0].elements);
      const glyph = elements.find(
        (element) =>
          element instanceof Drawing.Glyph &&
          element.glyphName === "noteheadHalf",
      ) as Drawing.Glyph;
      const stem = elements.find(
        (element) => element.role === "stem",
      ) as Drawing.Line;
      expect(stem.start.x).toBeCloseTo(
        glyph.position.x +
          (direction === "up"
            ? 1.18 - stem.strokeWidth / 2
            : stem.strokeWidth / 2),
      );
      expect(stem.start.y).toBeCloseTo(
        glyph.position.y + (direction === "up" ? -0.168 : 0.168),
      );
    },
  );

  test("uses the supplied metadata rather than the notehead's bounding box", () => {
    const score = prepare({
      tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
    });
    const anchor = vi
      .spyOn(score.notes[0].glyph, "getAnchor")
      .mockReturnValue([0.8, 0.3]);
    try {
      const stem = flatten(score.toDocument().pages[0].elements).find(
        (element) => element.role === "stem",
      ) as Drawing.Line;
      expect(anchor).toHaveBeenCalledWith("stemUpSE");
      expect(stem.start.x).toBeCloseTo(
        score.notes[0].glyph.spaceLeft + 0.8 - stem.strokeWidth / 2,
      );
      expect(stem.start.y).toBeCloseTo(4.7);
    } finally {
      anchor.mockRestore();
    }
  });

  test("falls back to the notehead edge when anchor metadata is absent", () => {
    const score = prepare({
      tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
    });
    const original = score.notes[0].glyph;
    const anchor = vi
      .spyOn(original, "getAnchor")
      .mockImplementation(vi.fn<SMUFL.Glyph["getAnchor"]>());
    try {
      const stem = flatten(score.toDocument().pages[0].elements).find(
        (element) => element.role === "stem",
      ) as Drawing.Line;
      expect(stem.start.x).toBeCloseTo(
        original.x +
          original.spaceLeft +
          original.glyphBBox.x +
          original.glyphBBox.width -
          stem.strokeWidth / 2,
      );
      expect(stem.start.y).toBe(5);
    } finally {
      anchor.mockRestore();
    }
  });

  test.each(["up", "down"] as const)(
    "spans all noteheads in a %s-stem chord",
    (direction) => {
      const score = prepare({
        tracks: [
          {
            notes: [60, 64, 67].map((pitch) => ({
              pitch,
              start: 0,
              duration: 1,
            })),
          },
        ],
      });
      for (const note of score.notes)
        if (!note.rest) note.stem = { _: direction };
      const elements = flatten(score.toDocument().pages[0].elements);
      const heads = elements.filter(
        (element) =>
          element instanceof Drawing.Glyph &&
          element.glyphName === "noteheadBlack",
      ) as Drawing.Glyph[];
      const stem = elements.find(
        (element) => element.role === "stem",
      ) as Drawing.Line;
      const upper = Math.min(...heads.map((head) => head.position.y));
      const lower = Math.max(...heads.map((head) => head.position.y));
      expect(stem.start.y).toBeCloseTo(
        direction === "up" ? lower - 0.168 : upper + 0.168,
      );
      expect(stem.end.y).toBeCloseTo(
        direction === "up" ? upper - 3 : lower + 3,
      );
    },
  );

  test.each(["up", "down"] as const)(
    "connects every %s stem to the primary beam and places secondary beams towards the noteheads",
    (direction) => {
      const score = beamedScore(direction, 2);
      const lines = drawingLines(score);
      const stems = lines.filter(({ line }) => line.role === "stem");
      const beams = lines.filter(({ line }) => line.role === "beam");
      expect(stems).toHaveLength(3);
      expect(beams).toHaveLength(2);
      const primary = beams[0];
      for (const stem of stems) {
        const fraction =
          (stem.end.x - primary.start.x) / (primary.end.x - primary.start.x);
        expect(stem.end.y).toBeCloseTo(
          primary.start.y + fraction * (primary.end.y - primary.start.y),
        );
      }
      expect(beams[1].start.y - primary.start.y).toBeCloseTo(
        direction === "up" ? 0.75 : -0.75,
      );
      expect(beams[1].end.y - primary.end.y).toBeCloseTo(
        direction === "up" ? 0.75 : -0.75,
      );
      expect(
        flatten(score.toDocument().pages[0].elements).filter(
          (element) => element.role === "flag",
        ),
      ).toHaveLength(0);
    },
  );

  const flags = [
    [0.5, "8th", -0.04, 0.132],
    [0.25, "16th", -0.088, 0.128],
    [0.125, "32nd", 0.376, -0.448],
    [0.0625, "64th", 1.172, -1.244],
    [0.031_25, "128th", 1.9, -2.076],
    [0.015_625, "256th", 2.592, -2.812],
    [0.007_812_5, "512th", 3.324, -3.608],
    [0.003_906_25, "1024th", 4.064, -4.684],
  ] as const;
  test.each(flags)(
    "positions %s-beat flags at the nominal stem end with anchor extensions",
    (duration, name, upAnchor, downAnchor) => {
      for (const direction of ["up", "down"] as const) {
        const score = prepare({
          tracks: [{ notes: [{ pitch: 60, start: 0, duration }] }],
        });
        score.notes[0].stem = { _: direction };
        const elements = flatten(score.toDocument().pages[0].elements);
        const flag = elements.find(
          (element) => element.role === "flag",
        ) as Drawing.Glyph;
        const stem = elements.find(
          (element) => element.role === "stem",
        ) as Drawing.Line;
        expect(flag.glyphName).toBe(
          `flag${name}${direction === "up" ? "Up" : "Down"}`,
        );
        expect(flag.position.x).toBeCloseTo(stem.end.x - stem.strokeWidth / 2);
        expect(flag.position.y).toBeCloseTo(direction === "up" ? 1.5 : 8.5);
        expect(stem.end.y).toBeCloseTo(
          flag.position.y - (direction === "up" ? upAnchor : downAnchor),
        );
        for (const element of elements) checkGeometry(element);
      }
    },
  );

  test("does not add flags to quarter notes, whole notes, rests or stemless notes", () => {
    for (const duration of [1, 2, 4]) {
      const score = prepare({
        tracks: [{ notes: [{ pitch: 60, start: 0, duration }] }],
      });
      expect(
        flatten(score.toDocument().pages[0].elements).filter(
          (element) => element.role === "flag",
        ),
      ).toHaveLength(0);
    }
    const score = prepare({
      tracks: [{ notes: [{ pitch: 60, start: 0, duration: 0.5 }] }],
    });
    score.notes[0].stem = { _: "none" };
    expect(
      flatten(score.toDocument().pages[0].elements).filter(
        (element) => element.role === "flag" || element.role === "stem",
      ),
    ).toHaveLength(0);
  });
});

test("renders forward and backward beam hooks on the anchored primary beam slope", () => {
  const data = beamedScore("up", 1).export();
  const notes = data.notes.filter((note) => !note.rest);
  notes[0].beam = [beam("begin", 1), beam("forward hook", 2)];
  notes[2].beam = [beam("end", 1), beam("backward hook", 2)];
  const score = SMUFL.Score.import(data);
  const controller = new SMUFL.Controller(score, {
    scale: 12,
    layoutType: LayoutType.Horizontal,
    debug: false,
    advanced: true,
  });
  controller.mount();
  controller.order();
  const beams = drawingLines(score).filter(({ line }) => line.role === "beam");
  const primary = beams[0];
  const hooks = beams.slice(1);
  expect(hooks).toHaveLength(2);
  const slope =
    (primary.end.y - primary.start.y) / (primary.end.x - primary.start.x);
  expect(hooks[0].end.x - hooks[0].start.x).toBe(1);
  expect(hooks[1].end.x - hooks[1].start.x).toBe(-1);
  for (const hook of hooks) {
    expect(hook.end.y - hook.start.y).toBeCloseTo(
      (hook.end.x - hook.start.x) * slope,
    );
    const fraction =
      (hook.start.x - primary.start.x) / (primary.end.x - primary.start.x);
    expect(hook.start.y).toBeCloseTo(
      primary.start.y + fraction * (primary.end.y - primary.start.y) + 0.75,
    );
  }
  controller.unmount();
});
