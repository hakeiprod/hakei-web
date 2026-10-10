"use client";
import { LayoutType } from "@/s-core/models/sheet";
import * as SMUFL from "@/s-core/models/smufl";
import type { Document } from "@/s-core/models/document";
import "@/s-core/models/document/extensions/to-svg";
import { bindNoteHighlights } from "@/s-core/models/browser/bind-note-highlights";
import { scrollNoteIntoView } from "@/s-core/models/browser/scroll-note-into-view";
import { layoutTypeAtom } from "@/store/layout-type";
import { scaleAtom } from "@/store/scale";
import { NumberInput, Select, SelectItem, Switch } from "@heroui/react";
import { useAtom } from "jotai";
import localFont from "next/font/local";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

const bravura = localFont({
  src: [{ path: "../s-core/const/bravura/Bravura.woff" }],
});
const layouts = [
  { type: LayoutType.Horizontal, label: "横スクロール" },
  { type: LayoutType.Vertical, label: "縦スクロール" },
  { type: LayoutType.Page, label: "ページ" },
];

export function ScoreViewer({ score }: { score: SMUFL.Score }) {
  const [layoutType, setLayoutType] = useAtom(layoutTypeAtom);
  const [scale, setScale] = useAtom(scaleAtom);
  const [advanced, setAdvanced] = useState(true);
  const [debug, setDebug] = useState(true);
  const [pagination, setPagination] = useState({ index: 0, total: 1 });
  const reference = useRef<HTMLDivElement | null>(null);
  const navigationReference = useRef<HTMLElement | null>(null);
  const controllerReference = useRef<SMUFL.Controller | null>(null);
  const documentReference = useRef<Document | null>(null);
  const pageIndexReference = useRef(0);
  const unbindHighlightsReference = useRef<(() => void) | null>(null);
  const renderPage = useCallback((index: number) => {
    const controller = controllerReference.current;
    const drawing = documentReference.current;
    if (!controller || !drawing || !reference.current) return;
    const pageIndex = Math.max(0, Math.min(index, drawing.pages.length - 1));
    const isPage = controller.options.layoutType === LayoutType.Page;
    const svg = drawing.toSVG({
      pageIndex,
      scale: controller.options.scale,
      fontFamily: bravura.style.fontFamily,
      paddingBottom: isPage ? 0 : 100,
    });
    if (isPage) {
      svg.style.marginInline = "auto";
    }
    svg.style.display = "block";
    const container = reference.current;
    unbindHighlightsReference.current?.();
    container.replaceChildren(svg);
    unbindHighlightsReference.current = bindNoteHighlights(
      controller.score,
      svg,
      controller.options.layoutType === LayoutType.Horizontal
        ? (node) => scrollNoteIntoView(container, node)
        : undefined,
    );
    pageIndexReference.current = pageIndex;
    setPagination({ index: pageIndex, total: drawing.pages.length });
  }, []);
  const rebuildDocument = useCallback(() => {
    const controller = controllerReference.current;
    if (!controller) return;
    controller.options.viewportWidth =
      reference.current?.clientWidth || window.innerWidth;
    const availableHeight = Math.max(
      1,
      (window.visualViewport?.height ?? window.innerHeight) -
        Math.max(0, reference.current?.getBoundingClientRect().top ?? 0) -
        (navigationReference.current?.offsetHeight || 56) -
        16,
    );
    controller.options.viewportHeight = availableHeight;
    if (reference.current)
      reference.current.style.height =
        controller.options.layoutType === LayoutType.Page
          ? `${availableHeight}px`
          : "";
    documentReference.current = controller.toDocument();
    renderPage(pageIndexReference.current);
  }, [renderPage]);
  const handleResize = useDebouncedCallback(() => {
    if (
      controllerReference.current?.options.layoutType === LayoutType.Vertical ||
      controllerReference.current?.options.layoutType === LayoutType.Page
    )
      rebuildDocument();
  }, 100);
  function handleScaleChange(
    eventOrValue: ChangeEvent<HTMLInputElement> | number,
  ) {
    const value =
      typeof eventOrValue === "number"
        ? eventOrValue
        : Number(eventOrValue.target.value);
    if (Number.isFinite(value) && value > 0) setScale(value);
  }
  function handleLayoutTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = Number(event.target.value);
    if (!layouts.some((layout) => layout.type === value)) return;
    pageIndexReference.current = 0;
    setLayoutType(value);
  }
  useEffect(() => {
    if (!controllerReference.current) {
      controllerReference.current = new SMUFL.Controller(score, {
        scale,
        layoutType,
        debug,
        advanced,
      });
    }
    const controller = controllerReference.current;
    if (
      controller.score !== score ||
      controller.options.layoutType !== layoutType
    )
      pageIndexReference.current = 0;
    controller.score = score;
    Object.assign(controller.options, { scale, layoutType, debug, advanced });
    controller.options.viewportWidth =
      reference.current?.clientWidth || window.innerWidth;
    const glyphClasses = new Map(
      score.notes.map(
        (note) => [note, [...(note.glyph?.classList ?? [])]] as const,
      ),
    );
    controller.mount();
    for (const note of score.notes)
      note.glyph.setClassName([...(glyphClasses.get(note) ?? [])]);
    rebuildDocument();
    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(handleResize);
    if (reference.current) observer?.observe(reference.current);
    if (navigationReference.current)
      observer?.observe(navigationReference.current);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
      handleResize.cancel();
      unbindHighlightsReference.current?.();
      unbindHighlightsReference.current = null;
      controller.unmount();
    };
  }, [
    advanced,
    debug,
    handleResize,
    layoutType,
    rebuildDocument,
    scale,
    score,
  ]);
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 py-3">
        <Select
          isRequired
          className="max-w-xs"
          label="描画タイプ"
          selectedKeys={[String(layoutType)]}
          onChange={handleLayoutTypeChange}
          aria-label="layouttype-input"
        >
          {layouts.map(({ type, label }) => (
            <SelectItem key={String(type)}>{label}</SelectItem>
          ))}
        </Select>
        <NumberInput
          className="max-w-xs"
          label="拡大率"
          minValue={1}
          value={scale}
          onChange={handleScaleChange}
          aria-label="scale-input"
        />
        <Switch aria-label="debug" isSelected={debug} onValueChange={setDebug}>
          debug
        </Switch>
        <Switch isSelected={advanced} onValueChange={setAdvanced}>
          advanced
        </Switch>
      </div>
      <div
        ref={reference}
        className={`${bravura.className} w-full ${layoutType === LayoutType.Page ? "bg-white text-black" : ""}`}
        data-layout={LayoutType[layoutType].toLowerCase()}
        style={{
          overflowX: "auto",
          overflowY: layoutType === LayoutType.Horizontal ? undefined : "auto",
          maxHeight: layoutType === LayoutType.Vertical ? "70vh" : undefined,
        }}
      />
      {layoutType === LayoutType.Page && (
        <nav
          ref={navigationReference}
          aria-label="楽譜のページ切り替え"
          className="flex items-center justify-center gap-4 py-3"
        >
          <button
            type="button"
            className="rounded border px-3 py-2 disabled:opacity-40"
            disabled={pagination.index === 0}
            onClick={() => renderPage(pagination.index - 1)}
          >
            前のページ
          </button>
          <span aria-live="polite">
            {pagination.index + 1} / {pagination.total}
          </span>
          <button
            type="button"
            className="rounded border px-3 py-2 disabled:opacity-40"
            disabled={pagination.index >= pagination.total - 1}
            onClick={() => renderPage(pagination.index + 1)}
          >
            次のページ
          </button>
        </nav>
      )}
    </>
  );
}
