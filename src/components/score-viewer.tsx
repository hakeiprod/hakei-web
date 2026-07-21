"use client";
import { LayoutType } from "@/s-core/models/sheet";
import * as SMUFL from "@/s-core/models/smufl";
import { layoutTypeAtom } from "@/store/layout-type";
import { scaleAtom } from "@/store/scale";
import { NumberInput, Select, SelectItem, Switch } from "@heroui/react";
import { useAtom } from "jotai";
import localFont from "next/font/local";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { filter, keys, map, pipe } from "remeda";
import { useDebouncedCallback } from "use-debounce";
import "../s-core/models/smufl/extensions/to-svg";

const bravura = localFont({
  src: [{ path: "../s-core/const/bravura/Bravura.woff" }],
});
export function ScoreViewer({ score }: { score: SMUFL.Score }) {
  const [layoutType, setLayoutType] = useAtom(layoutTypeAtom);
  const [scale, setScale] = useAtom(scaleAtom);
  const [advanced, setAdvanced] = useState(true);
  const reference = useRef<HTMLDivElement | null>(null);
  const controllerReference = useRef<SMUFL.Controller | null>(null);
  const handleResize = useDebouncedCallback(() => {
    if (controllerReference.current?.options.layoutType === LayoutType.Vertical)
      controllerReference.current?.render();
  }, 100);
  function handleScaleChange(
    eventOrValue: ChangeEvent<HTMLInputElement> | number,
  ) {
    const value =
      typeof eventOrValue === "number"
        ? eventOrValue
        : Number(eventOrValue.target.value);
    controllerReference.current?.setScale(value);
    controllerReference.current?.render();
  }
  function handleLayoutTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    controllerReference.current?.setLayoutType(Number(event.target.value));
    controllerReference.current?.render();
  }
  function handleAdvancedChange(value: boolean) {
    controllerReference.current?.setAdvanced(value);
    controllerReference.current?.render();
  }
  useEffect(() => {
    if (!controllerReference.current) {
      controllerReference.current = new SMUFL.Controller(score, {
        scale,
        layoutType,
        debug: false,
        advanced,
      });
    }
    const controller = controllerReference.current;
    controller.onChangeScale = (value) => setScale(value);
    controller.onChangeLayoutType = (value) => setLayoutType(value);
    controller.onChangeAdvanced = (value) => setAdvanced(value);
    controller.mount();
    const svg = controller.render();
    window.addEventListener("resize", handleResize);
    if (reference.current && svg) reference.current.replaceChildren(svg);
    return () => {
      controller.unmount();
      window.removeEventListener("resize", handleResize);
    };
  }, [
    advanced,
    handleResize,
    layoutType,
    scale,
    score,
    setLayoutType,
    setScale,
  ]);
  return (
    <>
      <div
        ref={reference}
        className={bravura.className}
        style={{ overflowX: "auto" }}
      />
      <NumberInput
        id=""
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
          map((key) => <SelectItem key={key}>{LayoutType[key]}</SelectItem>),
        )}
      </Select>
      <Switch isSelected={advanced} onValueChange={handleAdvancedChange}>
        advanced
      </Switch>
    </>
  );
}
