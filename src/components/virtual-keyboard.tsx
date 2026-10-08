"use client";
import { Keyboard } from "@/s-core/models/browser/keyboard";
import { KeyeventConnecter } from "@/s-core/models/keyboard_input/keyevent-connecter";
import { MidiinputConnecter } from "@/s-core/models/keyboard_input/midiinput-connecter";
import { Application } from "pixi.js";
import { useEffect, useRef } from "react";

export function VirtualKeyboard({ keyboard }: { keyboard: Keyboard }) {
  const reference = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const keys = new KeyeventConnecter(keyboard);
    const midi = new MidiinputConnecter(keyboard);
    const application = new Application();
    let disposed = false;
    let initialized = false;
    (async () => {
      await application.init({
        width:
          (keyboard.groupedRnageKeys.white?.length ?? 0) *
          Keyboard.WHITE_KEY_WIDTH,
        height: Keyboard.WHITE_KEY_HEIGHT,
      });
      initialized = true;
      if (disposed) {
        application.destroy(true);
        return;
      }
      for (const child of keyboard.container.removeChildren()) child.destroy();
      application.stage.addChild(keyboard.render());
      reference.current?.append(application.canvas);
    })();
    return () => {
      disposed = true;
      keys.dispose();
      midi.dispose();
      if (initialized) {
        // Pixi Container.removeChild detaches a reusable container, not a DOM node.
        // eslint-disable-next-line unicorn/prefer-dom-node-remove
        application.stage.removeChild(keyboard.container);
        application.destroy(true);
      }
    };
  }, [keyboard]);
  return <div ref={reference} />;
}
