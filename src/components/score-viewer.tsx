"use client";
import * as SMUFL from "@/s-core/models/smufl";
import { NumberInput, Select, SelectItem } from "@heroui/react";
import { ChangeEvent, RefObject, useEffect, useRef, useState } from "react";
import { filter, keys, map, pipe } from "remeda";
import localFont from "next/font/local";
import "../s-core/models/smufl/extensions/to_svg";
import { LayoutType } from "@/s-core/models/sheet";
import { useAtom } from "jotai";
import { layoutTypeAtom } from "@/store/layout-type";
import { scaleAtom } from "@/store/scale";

const bravura = localFont({
  src: [{ path: "../s-core/const/bravura/Bravura.woff" }],
});
export function ScoreViewer({
  score,
  ref,
}: {
  score?: SMUFL.Score;
  ref: RefObject<HTMLDivElement | null>;
}) {
  const [controller, setController] = useState<SMUFL.Controller>();
  const [layoutType, setLayoutType] = useAtom(layoutTypeAtom);
  const [scale, setScale] = useAtom(scaleAtom);
  function handleScaleChange(eOrValue: ChangeEvent<HTMLInputElement> | number) {
    const value =
      typeof eOrValue === "number" ? eOrValue : Number(eOrValue.target.value);
    if (!controller) return;
    setScale(value);
    controller.options.scale = value;
    controller.render();
  }
  const handleLayoutTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    if (!controller) return;
    setLayoutType(Number(e.target.value));
    controller.options.layoutType = Number(e.target.value);
    controller.render();
  };
  useEffect(() => {
    if (score) {
      const controller = new SMUFL.Controller(score, { scale, layoutType });
      controller.mount();
      const svg = controller.render();
      setController(controller);
      if (!ref.current?.hasChildNodes() && svg) ref.current?.appendChild(svg);
      // window.addEventListener("resize", () => controller.render());
    }
  }, [score]);
  return (
    <>
      <div
        ref={ref}
        className={bravura.className}
        style={{ overflowX: "auto" }}
      />
      <NumberInput
        className="max-w-xs"
        placeholder="Scale"
        value={scale}
        onChange={handleScaleChange}
      />
      <Select
        isRequired
        className="max-w-xs"
        label="Layout Type"
        selectedKeys={layoutType.toString()}
        onChange={handleLayoutTypeChange}
      >
        {pipe(
          LayoutType,
          keys(),
          filter((k) => !isNaN(Number(k))),
          map((key) => <SelectItem key={key}>{LayoutType[key]}</SelectItem>)
        )}
      </Select>
    </>
  );
}
