import * as Engraving from "../engraving";
import { LayoutType } from "../sheet";
import type { SheetScoreJson } from "../import/score-schema";
import {
  validateSheetScore,
  tryValidateSmallSheetScore,
  hasBoundedValidationSize,
} from "./validate-sheet-score";
import { drainSteps, type RenderSteps } from "../sheet/render-steps";
import {
  drainCooperatively,
  type RenderTaskPriority,
} from "./render-scheduler";
import {
  prepareNoteHighlightsSteps,
  type HighlightBinding,
} from "./bind-note-highlights";
import "../document/extensions/to-svg";

export type RenderStage =
  "validate" | "build" | "layout" | "document" | "svg" | "highlights";
export type RenderOptions = ConstructorParameters<
  typeof Engraving.Controller
>[1] & { fontFamily?: string; svgPaddingBottom?: number };

function* freezeSteps(value: object): RenderSteps<void> {
  const pending = [value],
    seen = new WeakSet<object>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const child of Object.values(current))
      if (child && typeof child === "object") pending.push(child);
    Object.freeze(current);
    yield;
  }
}

const boundedSnapshots = new WeakSet<SourceSnapshot>();
export class SourceSnapshot {
  private constructor(readonly data: SheetScoreJson) {
    // This only chooses task priority after full validation; it never caps or
    // changes musical content. Include unknown fields in the existing bound.
    if (hasBoundedValidationSize(data)) boundedSnapshots.add(this);
  }
  get taskPriority(): RenderTaskPriority {
    return boundedSnapshots.has(this) ? "user-visible" : "background";
  }
  static tryCreateSmall(input: unknown) {
    const data = tryValidateSmallSheetScore(input);
    if (data === undefined) return;
    drainSteps(freezeSteps(data));
    return Object.freeze(new SourceSnapshot(data));
  }
  static async create(input: unknown, signal?: AbortSignal) {
    // Capture caller values before any suspension. The detached clone is never
    // written back to the importer, saved revision or diagnostics.
    const data = await validateSheetScore(input, signal);
    await drainCooperatively(freezeSteps(data), { signal });
    return Object.freeze(new SourceSnapshot(data));
  }
}
export const createSourceSnapshot = (input: unknown, signal?: AbortSignal) =>
  SourceSnapshot.create(input, signal);

export const tryCreateSmallSourceSnapshot = (input: unknown) =>
  SourceSnapshot.tryCreateSmall(input);

function captureOptions(input: RenderOptions): Readonly<RenderOptions> {
  const options = structuredClone(input);
  if (
    ![LayoutType.Horizontal, LayoutType.Vertical, LayoutType.Page].includes(
      options.layoutType,
    )
  )
    throw new RangeError("Unknown layout");
  if (!Number.isFinite(options.scale) || options.scale <= 0)
    throw new RangeError("Rendering scale must be positive and finite");
  for (const number of [options.viewportWidth, options.viewportHeight])
    if (number !== undefined && (!Number.isFinite(number) || number <= 0))
      throw new RangeError("Rendering dimensions must be positive and finite");
  if (
    options.svgPaddingBottom !== undefined &&
    (!Number.isFinite(options.svgPaddingBottom) || options.svgPaddingBottom < 0)
  )
    throw new RangeError("Invalid SVG padding");
  if (options.pageLayout) {
    const { width, height, margin } = options.pageLayout;
    if (
      ![width, height, margin].every(Number.isFinite) ||
      width <= 0 ||
      height <= 0 ||
      margin < 0 ||
      width <= margin * 2 ||
      height <= margin * 2
    )
      throw new RangeError("Invalid page layout");
    Object.freeze(options.pageLayout);
  }
  if (typeof options.debug === "object") {
    Object.freeze(options.debug.showBoundingBox);
    Object.freeze(options.debug);
  }
  return Object.freeze(options);
}

export async function renderScore(
  source: SourceSnapshot,
  inputOptions: RenderOptions,
  context: {
    signal?: AbortSignal;
    onStage?: (stage: RenderStage) => void;
    onHighlight?: (node: SVGGElement) => void;
  } = {},
) {
  const options = captureOptions(inputOptions),
    pages: SVGSVGElement[] = [],
    bindings: HighlightBinding[] = [];
  let controller: Engraving.Controller | undefined,
    active: HighlightBinding | undefined,
    disposed = false;
  const dispose = ({ removeDOM = true }: { removeDOM?: boolean } = {}) => {
    if (disposed) return;
    disposed = true;
    for (const binding of bindings) binding.dispose();
    bindings.length = 0;
    if (removeDOM) for (const svg of pages) if (svg.isConnected) svg.remove();
    pages.length = 0;
    // A private graph is discarded rather than reset for reuse. Resetting every
    // Word/Ligature here allocates thousands of objects during route teardown.
    // Browser subscriptions have already been removed by the bindings above.
    if (controller) controller.score.layoutPass = null;
    controller = undefined;
    active = undefined;
  };
  function* buildSteps() {
    context.onStage?.("build");
    // The snapshot has passed the existing complete Sheet schema; this bridge
    // reconciles its transport type with the legacy exported-model API only.
    const data = source.data as unknown as ReturnType<
      Engraving.Score["export"]
    >;
    const score = yield* Engraving.Score.importSteps(data);
    controller = new Engraving.Controller(score, { ...options });
    context.onStage?.("layout");
    yield* controller.mountSteps();
    context.onStage?.("document");
    const drawing = yield* controller.toDocumentSteps();
    context.onStage?.("svg");
    for (let pageIndex = 0; pageIndex < drawing.pages.length; pageIndex++) {
      const svg = yield* drawing.toSVGSteps({
        pageIndex,
        scale: options.scale,
        fontFamily: options.fontFamily,
        paddingBottom:
          options.svgPaddingBottom ??
          (options.layoutType === LayoutType.Page ? 0 : 100),
      });
      svg.style.display = "block";
      if (options.layoutType === LayoutType.Page)
        svg.style.marginInline = "auto";
      pages.push(svg);
    }
    context.onStage?.("highlights");
    for (const svg of pages)
      bindings.push(
        yield* prepareNoteHighlightsSteps(score, svg, context.onHighlight),
      );
    return { score, drawing };
  }
  try {
    const { score, drawing } = await drainCooperatively(buildSteps(), {
      ...context,
      priority: source.taskPriority,
    });
    if (context.signal?.aborted)
      throw new DOMException("Rendering aborted", "AbortError");
    return {
      score,
      drawing,
      pages,
      options,
      selectPage(index: number) {
        if (disposed) throw new Error("Rendering disposed");
        if (!Number.isInteger(index))
          throw new RangeError("Invalid page index");
        const pageIndex = Math.max(0, Math.min(index, pages.length - 1));
        active?.deactivate();
        active = bindings[pageIndex];
        active.activate();
        return { pageIndex, svg: pages[pageIndex] };
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
export type RenderedScore = Awaited<ReturnType<typeof renderScore>>;
