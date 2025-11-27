"use client";
import { Keyboard } from "@/s-core/models/browser/keyboard";
import { Application } from "pixi.js";
import { useEffect, useRef } from "react";

export function VirtualKeyboard(props: { keyboard?: Keyboard }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (async () => {
      if (!props.keyboard) return;
      const application = new Application();
      await application.init({
        width:
          (props.keyboard.groupedRnageKeys.white?.length ?? 0) *
          Keyboard.WHITE_KEY_WIDTH,
        height: Keyboard.WHITE_KEY_HEIGHT,
      });
      application.stage.addChild(props.keyboard.render());
      ref.current?.appendChild(application.canvas);
    })();
  }, [props.keyboard]);
  return (
    <>
      <div ref={ref} />
    </>
  );
}
