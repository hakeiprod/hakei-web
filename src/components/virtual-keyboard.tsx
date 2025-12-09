"use client";
import { Keyboard } from "@/s-core/models/browser/keyboard";
import { Application } from "pixi.js";
import { useEffect, useRef } from "react";
import { KeyeventConnecter } from "@/s-core/models/keyboard_input/keyevent-connecter";
import { MidiinputConnecter } from "@/s-core/models/keyboard_input/midiinput-connecter";

export function VirtualKeyboard({ keyboard }: { keyboard: Keyboard }) {
  const reference = useRef<HTMLDivElement>(null);
  useEffect(() => {
    new KeyeventConnecter(keyboard);
    new MidiinputConnecter(keyboard);
    (async () => {
      const application = new Application();
      await application.init({
        width:
          (keyboard.groupedRnageKeys.white?.length ?? 0) *
          Keyboard.WHITE_KEY_WIDTH,
        height: Keyboard.WHITE_KEY_HEIGHT,
      });
      application.stage.addChild(keyboard.render());
      reference.current?.append(application.canvas);
    })();
  }, [keyboard]);
  return <div ref={reference} />;
}
