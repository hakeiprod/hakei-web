"use client";
import * as SMUFL from "@/s-core/models/smufl";
import { NumberInput, Select, SelectItem } from "@heroui/react";
import { ChangeEvent, useEffect, useMemo, useRef } from "react";
import { filter, keys, map, pipe } from "remeda";
import localFont from "next/font/local";
import "../s-core/models/smufl/extensions/to-svg";
import { LayoutType } from "@/s-core/models/sheet";
import { useAtom } from "jotai";
import { layoutTypeAtom } from "@/store/layout-type";
import { scaleAtom } from "@/store/scale";
import { useDebouncedCallback } from "use-debounce";

const bravura = localFont({
  src: [{ path: "../s-core/const/bravura/Bravura.woff" }],
});
export function ScoreViewer({ score }: { score: SMUFL.Score }) {
  const [layoutType, setLayoutType] = useAtom(layoutTypeAtom);
  const [scale, setScale] = useAtom(scaleAtom);
  const reference = useRef<HTMLDivElement | null>(null);
  const controller = useMemo(() => {
    const controller = new SMUFL.Controller(score, { scale, layoutType });
    controller.onChangeScale = (value) => setScale(value);
    controller.onChangeLayoutType = (value) => setLayoutType(value);
    return controller;
  }, [layoutType, scale, score, setLayoutType, setScale]);
  const handleResize = useDebouncedCallback(() => {
    if (controller.options.layoutType === LayoutType.Vertical)
      controller?.render();
  }, 100);
  function handleScaleChange(
    eventOrValue: ChangeEvent<HTMLInputElement> | number
  ) {
    const value =
      typeof eventOrValue === "number"
        ? eventOrValue
        : Number(eventOrValue.target.value);
    controller.setScale(value);
    controller.render();
  }
  function handleLayoutTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    controller.setLayoutType(Number(event.target.value));
    controller.render();
  }
  useEffect(() => {
    controller.mount();
    const svg = controller.render();
    window.addEventListener("resize", handleResize);
    if (!reference.current?.hasChildNodes() && svg)
      reference.current?.append(svg);
    return () => window.removeEventListener("resize", handleResize);
  }, [controller, handleResize]);
  return (
    <>
      <div
        ref={reference}
        className={bravura.className}
        style={{ overflowX: "auto" }}
      />
      <NumberInput
        className="max-w-xs"
        placeholder="Scale"
        value={scale}
        onChange={handleScaleChange}
        aria-label="scale-input"
      />
      <Select
        isRequired
        className="max-w-xs"
        label="Layout Type"
        selectedKeys={layoutType.toString()}
        onChange={handleLayoutTypeChange}
        aria-label="layouttype-input"
      >
        {pipe(
          LayoutType,
          keys(),
          filter((k) => !Number.isNaN(Number(k))),
          map((key) => <SelectItem key={key}>{LayoutType[key]}</SelectItem>)
        )}
      </Select>
    </>
  );
}
