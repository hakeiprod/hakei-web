"use client";
import * as Core from "@/s-core/models/core";
import { Keyboard } from "@/s-core/models/browser/keyboard";
import { Application } from "pixi.js";
import { useEffect, useRef } from "react";

export function VirtualKeyboard({
  score,
}: {
  score: ReturnType<Core.Score["export"]>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const keyboard = new Keyboard(Core.Score.import(score).pitchRange);
    (async () => {
      if (!keyboard) return;
      const application = new Application();
      await application.init({
        width:
          (keyboard.groupedRnageKeys.white?.length ?? 0) *
          Keyboard.WHITE_KEY_WIDTH,
        height: Keyboard.WHITE_KEY_HEIGHT,
      });
      application.stage.addChild(keyboard.render());
      ref.current?.appendChild(application.canvas);
    })();
  }, [score]);
  return (
    <>
      <div ref={ref} />
    </>
  );
}
