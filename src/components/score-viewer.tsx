"use client";
import { Button, Input, RadioGroup, Switch } from "@heroui/react";
import { debugAtom } from "@/store/debug";
import { LayoutType } from "@/s-core/models/sheet";
import * as Engraving from "@/s-core/models/engraving";
import {
  createSourceSnapshot,
  renderScore,
  type SourceSnapshot,
  type RenderedScore,
} from "@/s-core/models/browser/render-score";
import { createScoreSurface } from "@/s-core/models/browser/score-surface";
import {
  drainCooperatively,
  yieldToTask,
} from "@/s-core/models/browser/render-scheduler";
import "@/s-core/models/document/extensions/to-svg";
import { scrollNoteIntoView } from "@/s-core/models/browser/scroll-note-into-view";
import { layoutTypeAtom } from "@/store/layout-type";
import { scaleAtom } from "@/store/scale";

import { useAtom } from "jotai";
import localFont from "next/font/local";
import {
  ChangeEvent,
  memo,
  useCallback,
  useId,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";
import type { RenderSteps } from "@/s-core/models/sheet/render-steps";
import { useDebouncedCallback } from "use-debounce";
const bravura = localFont({
  src: [{ path: "../s-core/const/bravura/Bravura.woff" }],
});
const layouts = [
  { type: LayoutType.Horizontal, label: "横スクロール" },
  { type: LayoutType.Vertical, label: "縦スクロール" },
  { type: LayoutType.Page, label: "ページ" },
];
const unsubscribeHydration = () => {};
const subscribeHydration = () => unsubscribeHydration;
const clientHydration = () => true;
const serverHydration = () => false;
export const ScoreViewer = memo(function ScoreViewer({
  score,
  source,
  onReady,
  onStatusChange,
  prepareInitialScore,
}: {
  score?: Engraving.Score;
  source?: SourceSnapshot;
  onReady?: (score: Engraving.Score) => void;
  onStatusChange?: (ready: boolean) => void;
  prepareInitialScore?: (score: Engraving.Score) => RenderSteps<void>;
}) {
  const [layoutType, setLayoutType] = useAtom(layoutTypeAtom),
    [scale, setScale] = useAtom(scaleAtom);
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    clientHydration,
    serverHydration,
  );
  const [advanced, setAdvanced] = useState(true),
    [debug, setDebug] = useAtom(debugAtom);
  const [pagination, setPagination] = useState({ index: 0, total: 1 });
  const [state, setState] = useState<
    "loading" | "ready" | "error" | "cancelled"
  >("loading");
  const [retry, setRetry] = useState(0),
    [viewportRevision, setViewportRevision] = useState(0);
  const [legacy, setLegacy] = useState<{
    input: Engraving.Score;
    source: SourceSnapshot;
  }>();
  const placeholderReference = useRef<HTMLDivElement | null>(null);
  const surfaceReference = useRef<ReturnType<typeof createScoreSurface> | null>(
    null,
  );
  const reference = useRef<HTMLDivElement | null>(null),
    navigationReference = useRef<HTMLElement | null>(null);
  const committed = useRef<{
    result: RenderedScore;
    source: SourceSnapshot;
  } | null>(null);
  const generation = useRef(0),
    abortReference = useRef<AbortController | null>(null),
    pageIndexReference = useRef(0);
  const snapshot =
    source ?? (legacy && legacy.input === score ? legacy.source : undefined);
  useLayoutEffect(() => {
    const surface = createScoreSurface(placeholderReference.current!, {
      deferResize: true,
    });
    surfaceReference.current = surface;
    reference.current = surface.element;
    return () => {
      // Invalidate the latest job, including work started after mounting the surface.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++generation.current;
      abortReference.current?.abort();
      surface.retire();
      committed.current?.result.dispose({ removeDOM: false });
      committed.current = null;
      reference.current = null;
      surfaceReference.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    const current = committed.current;
    if (
      state === "loading" &&
      current === null &&
      !reference.current?.firstElementChild
    ) {
      surfaceReference.current?.prime();
      return;
    }
    surfaceReference.current?.setVisible(
      state === "ready" &&
        current !== null &&
        current.source === snapshot &&
        current.result.options.layoutType === layoutType &&
        current.result.options.scale === scale &&
        current.result.options.debug === debug &&
        current.result.options.advanced === advanced &&
        !abortReference.current?.signal.aborted,
    );
  }, [state, snapshot, layoutType, scale, debug, advanced]);
  useLayoutEffect(() => {
    const surface = surfaceReference.current;
    if (!surface) return;
    const container = surface.element;
    container.className = `${bravura.className} w-full ${layoutType === LayoutType.Page ? "bg-white text-black" : ""}`;
    placeholderReference.current!.className = container.className;
    container.dataset.layout = layouts.some(({ type }) => type === layoutType)
      ? LayoutType[layoutType].toLowerCase()
      : "invalid";
    container.dataset.renderState = state;
    container.style.overflowX = "auto";
    container.style.overflowY =
      layoutType === LayoutType.Horizontal ? "" : "auto";
    if (!committed.current)
      container.style.maxHeight =
        layoutType === LayoutType.Vertical
          ? `${window.innerHeight * 0.7}px`
          : "";
    surface.sync();
  }, [layoutType, state]);
  useLayoutEffect(() => {
    ++generation.current;
    abortReference.current?.abort();
    if (committed.current && committed.current.source !== snapshot) {
      reference.current?.replaceChildren();
      committed.current.result.dispose();
      committed.current = null;
      pageIndexReference.current = 0;
    }
    return () => {
      // Read the latest counter to invalidate work started after this effect.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++generation.current;
      abortReference.current?.abort();
    };
  }, [
    snapshot,
    score,
    scale,
    layoutType,
    advanced,
    debug,
    retry,
    viewportRevision,
  ]);
  useEffect(() => {
    if (source || !score) return;
    const abort = new AbortController();
    createSourceSnapshot(score.export(), abort.signal)
      .then((source) => {
        if (!abort.signal.aborted) setLegacy({ input: score, source });
      })
      .catch(() => {
        if (!abort.signal.aborted) setState("error");
      });
    return () => abort.abort();
  }, [source, score]);
  const renderPage = useCallback((index: number) => {
    const current = committed.current?.result,
      container = reference.current;
    if (!current || !container) return;
    const pageIndex = Math.max(0, Math.min(index, current.pages.length - 1));
    container.replaceChildren(current.pages[pageIndex]);
    surfaceReference.current?.prepare();
    current.selectPage(pageIndex);
    container.style.maxHeight =
      current.options.layoutType === LayoutType.Vertical
        ? `${window.innerHeight * 0.7}px`
        : "";
    surfaceReference.current?.commit({
      height:
        current.options.layoutType === LayoutType.Page
          ? current.options.viewportHeight
          : undefined,
    });
    pageIndexReference.current = pageIndex;
    setPagination({ index: pageIndex, total: current.pages.length });
  }, []);
  const measuredDimensions = useRef<{ width: number; height: number } | null>(
    null,
  );
  const measureViewport = useCallback(() => {
    const container = reference.current;
    if (!container) return null;
    return {
      width: Math.max(
        1,
        (placeholderReference.current?.clientWidth || window.innerWidth) -
          Math.max(0, container.offsetWidth - container.clientWidth),
      ),
      height: Math.max(
        1,
        (window.visualViewport?.height ?? window.innerHeight) -
          Math.max(
            0,
            placeholderReference.current?.getBoundingClientRect().top ?? 0,
          ) -
          (navigationReference.current?.offsetHeight || 56) -
          16,
      ),
    };
  }, []);
  const handleResize = useDebouncedCallback(() => {
    const next = measureViewport(),
      previous = measuredDimensions.current;
    if (
      !next ||
      (previous?.width === next.width &&
        (layoutType !== LayoutType.Page || previous.height === next.height))
    )
      return;
    measuredDimensions.current = next;
    if (layoutType === LayoutType.Horizontal) {
      surfaceReference.current?.commit();
      return;
    }
    setViewportRevision((value) => value + 1);
  }, 100);
  const beginUpdate = useCallback(() => {
    surfaceReference.current?.setVisible(false);
    ++generation.current;
    abortReference.current?.abort();
    setState("loading");
    onStatusChange?.(false);
  }, [onStatusChange]);
  const onViewportResize = useCallback(() => {
    if (layoutType === LayoutType.Horizontal && !committed.current) return;
    const next = measureViewport(),
      previous = measuredDimensions.current;
    if (
      !next ||
      (previous?.width === next.width &&
        (layoutType !== LayoutType.Page || previous.height === next.height))
    )
      return;
    if (layoutType === LayoutType.Vertical || layoutType === LayoutType.Page)
      beginUpdate();
    handleResize();
  }, [layoutType, measureViewport, beginUpdate, handleResize]);
  const handleScaleChange = useCallback(
    (eventOrValue: ChangeEvent<HTMLInputElement> | number) => {
      const value =
        typeof eventOrValue === "number"
          ? eventOrValue
          : Number(eventOrValue.target.value);
      if (Number.isFinite(value) && value > 0 && value !== scale) {
        handleResize.cancel();
        beginUpdate();
        setScale(value);
      }
    },
    [scale, handleResize, beginUpdate, setScale],
  );
  const handleLayoutTypeChange = useCallback(
    (valueText: string) => {
      const value = Number(valueText);
      if (
        !layouts.some((layout) => layout.type === value) ||
        value === layoutType
      )
        return;
      handleResize.cancel();
      beginUpdate();
      pageIndexReference.current = 0;
      setLayoutType(value);
    },
    [layoutType, handleResize, beginUpdate, setLayoutType],
  );
  useLayoutEffect(() => {
    // This effect runs only after a client commit. Jotai already supplies the
    // current stored options; SSR control placeholders need not delay drawing.
    if (!snapshot) return;
    const container = reference.current;
    if (!container) return;
    const ownGeneration = ++generation.current,
      abort = new AbortController();
    abortReference.current?.abort();
    abortReference.current = abort;
    const sameSource = committed.current?.source === snapshot;
    if (!sameSource) {
      committed.current?.result.dispose();
      committed.current = null;
      container.replaceChildren();
      pageIndexReference.current = 0;
    }
    const run = async () => {
      setState("loading");
      onStatusChange?.(false);
      try {
        if (!committed.current && layoutType !== LayoutType.Horizontal) {
          // Finish the initial React commit before reading layout. Measuring
          // while stored controls are still hydrating forces a second layout
          // during the first rendering slice's yield.
          await yieldToTask(abort.signal);
          if (abort.signal.aborted || generation.current !== ownGeneration)
            return;
        }
        // Horizontal notation has no viewport-dependent wrapping or spacing.
        // Defer DOM layout reads until the completed SVG needs its scroll box.
        const dimensions =
          layoutType === LayoutType.Horizontal
            ? {
                width: Math.max(1, window.innerWidth),
                height: Math.max(
                  1,
                  window.visualViewport?.height ?? window.innerHeight,
                ),
              }
            : measureViewport();
        if (!dimensions) return;
        if (layoutType !== LayoutType.Horizontal)
          measuredDimensions.current = dimensions;
        const availableHeight = dimensions.height;
        if (!committed.current) {
          container.style.contain = "layout paint";
          container.style.height =
            layoutType === LayoutType.Page ? `${availableHeight}px` : "";
        }
        const next = await renderScore(
          snapshot,
          {
            scale,
            layoutType,
            advanced,
            debug,
            viewportWidth: dimensions.width,
            viewportHeight: availableHeight,
            fontFamily: bravura.style.fontFamily,
          },
          {
            signal: abort.signal,
            onHighlight:
              layoutType === LayoutType.Horizontal
                ? (node) => scrollNoteIntoView(container, node)
                : undefined,
          },
        );
        if (abort.signal.aborted || generation.current !== ownGeneration) {
          next.dispose();
          return;
        }
        try {
          const old = committed.current;
          if (old?.source === snapshot) {
            const previousNotes = old.result.score.notes;
            function* transfer() {
              const classes = new Map<string, string[]>();
              for (const note of previousNotes) {
                if (note.glyph.classList.length > 0)
                  classes.set(`${note.trackId}/${note.id}`, [
                    ...note.glyph.classList,
                  ]);
                yield;
              }
              for (const note of next.score.notes) {
                const retained = classes.get(`${note.trackId}/${note.id}`);
                if (retained || note.glyph.classList.length > 0)
                  note.glyph.setClassName(retained ?? []);
                yield;
              }
            }
            await drainCooperatively(transfer(), { signal: abort.signal });
          }
          if (!old && prepareInitialScore)
            await drainCooperatively(prepareInitialScore(next.score), {
              signal: abort.signal,
              priority: snapshot.taskPriority,
            });
          if (abort.signal.aborted || generation.current !== ownGeneration) {
            next.dispose();
            return;
          }
          committed.current = { result: next, source: snapshot };
          renderPage(pageIndexReference.current);
          if (layoutType === LayoutType.Horizontal)
            measuredDimensions.current = measureViewport();
          old?.result.dispose();
          container.dataset.renderGeneration = String(ownGeneration);
          // The SVG is owned outside React. Publish its ready state and
          // remove the loading overlay in the same commit as its DOM binding.
          flushSync(() => {
            setState("ready");
            onReady?.(next.score);
            onStatusChange?.(true);
          });
        } catch (error) {
          next.dispose();
          throw error;
        }
      } catch (error) {
        if (abort.signal.aborted || generation.current !== ownGeneration)
          return;
        setState(
          error instanceof DOMException && error.name === "AbortError"
            ? "cancelled"
            : "error",
        );
        onStatusChange?.(false);
      }
    };
    run();
    return () => abort.abort();
  }, [
    snapshot,
    scale,
    layoutType,
    advanced,
    debug,
    retry,
    viewportRevision,
    measureViewport,
    renderPage,
    onReady,
    onStatusChange,
    prepareInitialScore,
  ]);
  useEffect(() => {
    window.addEventListener("resize", onViewportResize);
    window.visualViewport?.addEventListener("resize", onViewportResize);
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(onViewportResize);
    if (reference.current) observer?.observe(reference.current);
    if (placeholderReference.current)
      observer?.observe(placeholderReference.current);
    if (navigationReference.current)
      observer?.observe(navigationReference.current);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", onViewportResize);
      window.visualViewport?.removeEventListener("resize", onViewportResize);
      handleResize.cancel();
    };
  }, [handleResize, onViewportResize]);
  useEffect(
    () => () => {
      ++generation.current;
      abortReference.current?.abort();
      committed.current?.result.dispose();
      committed.current = null;
    },
    [],
  );
  const cancel = () => {
    ++generation.current;
    abortReference.current?.abort();
    setState("cancelled");
    onStatusChange?.(false);
  };
  const layoutInputName = useId();
  const controlLayout = hydrated ? layoutType : LayoutType.Horizontal;
  const controlScale = hydrated ? scale : 12;
  const controlDebug = hydrated ? debug : false;
  const controls = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-3 py-3">
        <RadioGroup
          isRequired
          orientation="horizontal"
          className="h-14 w-full max-w-xs"
          classNames={{
            base: "gap-1",
            label: "text-xs leading-4",
            wrapper: "flex-nowrap gap-1",
          }}
          label="描画タイプ"
          value={String(controlLayout)}
          onValueChange={handleLayoutTypeChange}
          aria-label="layouttype-input"
        >
          {layouts.map(({ type, label }) => (
            <label
              key={String(type)}
              data-selected={controlLayout === type}
              className="m-0 flex h-8 min-w-0 max-w-none flex-1 cursor-pointer items-center justify-center gap-0 rounded-md border border-default px-1 py-0 data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus"
            >
              <input
                type="radio"
                name={layoutInputName}
                value={String(type)}
                checked={controlLayout === type}
                onChange={() => handleLayoutTypeChange(String(type))}
                className="sr-only"
              />
              <span className="whitespace-nowrap text-xs">{label}</span>
            </label>
          ))}
        </RadioGroup>
        <Input
          className="max-w-xs"
          label="拡大率"
          type="number"
          min={1}
          step="any"
          value={String(controlScale)}
          onChange={handleScaleChange}
          aria-label="scale-input"
        />
        <Switch
          aria-label="debug"
          isSelected={controlDebug}
          onValueChange={(value) => {
            beginUpdate();
            setDebug(value);
          }}
        >
          debug
        </Switch>
        <Switch
          isSelected={advanced}
          onValueChange={(value) => {
            beginUpdate();
            setAdvanced(value);
          }}
        >
          advanced
        </Switch>
      </div>
    ),
    [
      controlLayout,
      controlScale,
      controlDebug,
      advanced,
      layoutInputName,
      handleScaleChange,
      handleLayoutTypeChange,
      beginUpdate,
      setDebug,
      setAdvanced,
    ],
  );
  return (
    <>
      {controls}
      <div className="relative min-w-0">
        {state !== "ready" && (
          <div className="absolute left-0 top-0 z-10 rounded bg-content1/95 p-2">
            {state === "loading" ? (
              <>
                <span role="status">
                  {pagination.total > 0
                    ? "楽譜の表示を準備・更新しています。"
                    : "楽譜の表示を準備しています。"}
                </span>
                <Button
                  type="button"
                  onPress={cancel}
                  isDisabled={!snapshot || !hydrated}
                >
                  表示を取消
                </Button>
              </>
            ) : (
              <>
                <span role={state === "error" ? "alert" : "status"}>
                  {state === "error"
                    ? "楽譜を表示できませんでした。再試行してください。"
                    : "表示を取り消しました。"}
                </span>
                <Button
                  type="button"
                  onPress={() => setRetry((value) => value + 1)}
                >
                  再試行
                </Button>
              </>
            )}
          </div>
        )}
        <div ref={placeholderReference} className="w-full" />
      </div>
      {controlLayout === LayoutType.Page && (
        <nav
          ref={navigationReference}
          aria-label="楽譜のページ切り替え"
          className="flex items-center justify-center gap-4 py-3"
        >
          <Button
            type="button"
            onClick={() => renderPage(pagination.index - 1)}
            isDisabled={state !== "ready" || pagination.index === 0}
            color="default"
            variant="bordered"
            className="max-w-full whitespace-normal"
          >
            前のページ
          </Button>
          <span aria-live="polite">
            {pagination.index + 1} / {pagination.total}
          </span>
          <Button
            type="button"
            onClick={() => renderPage(pagination.index + 1)}
            isDisabled={
              state !== "ready" || pagination.index >= pagination.total - 1
            }
            color="default"
            variant="bordered"
            className="max-w-full whitespace-normal"
          >
            次のページ
          </Button>
        </nav>
      )}
    </>
  );
});
