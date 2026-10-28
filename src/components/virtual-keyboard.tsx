"use client";
import { Keyboard } from "@/s-core/models/browser/keyboard";
import { KeyeventConnecter } from "@/s-core/models/keyboard_input/keyevent-connecter";
import { MidiinputConnecter } from "@/s-core/models/keyboard_input/midiinput-connecter";
import { Application } from "pixi.js";
import { useEffect, useRef } from "react";

export function VirtualKeyboard({ keyboard }: { keyboard: Keyboard }) {
  const reference = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const keys = new KeyeventConnecter(keyboard);
    const midi = new MidiinputConnecter(keyboard);
    let application: Application | undefined;
    let disposed = false;
    let initialized = false;
    let visible = typeof IntersectionObserver === "undefined";
    let releaseVisibility!: () => void;
    const firstVisible = new Promise<void>((resolve) => {
      releaseVisibility = resolve;
      if (visible) resolve();
    });
    let movement: { move: boolean; globalMove: boolean } | undefined;
    const updateVisibility = () => {
      if (!initialized || !application || !movement || disposed) return;
      const events = application.renderer.events;
      events.features.move = visible && movement.move;
      events.features.globalMove = visible && movement.globalMove;
      if (visible) application.start();
      else application.stop();
    };
    let visibility: IntersectionObserver | undefined;
    let frameId: number | undefined;
    let releasePaint!: () => void;
    const afterPaint = new Promise<void>((resolve) => {
      releasePaint = resolve;
      frameId = requestAnimationFrame(() => {
        frameId = requestAnimationFrame(() => {
          frameId = undefined;
          resolve();
        });
      });
    });
    if (typeof IntersectionObserver !== "undefined") {
      visibility = new IntersectionObserver((entries) => {
        if (disposed) return;
        visible = entries.some((entry) => entry.isIntersecting);
        if (visible) releaseVisibility();
        updateVisibility();
      });
      visibility.observe(reference.current!);
    }
    (async () => {
      await afterPaint;
      if (disposed) return;
      // Keep note input and its graphics state available offscreen. Only the
      // renderer and global Pixi pointer listeners wait for actual visibility.
      for (const child of keyboard.container.removeChildren()) child.destroy();
      const graphics = keyboard.render();
      await firstVisible;
      if (disposed) return;
      application = new Application();
      await application.init({
        canvas: reference.current!,
        autoStart: false,
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
      application.stage.addChild(graphics);
      application.render();
      const events = application.renderer.events;
      movement = {
        move: events.features.move,
        globalMove: events.features.globalMove,
      };
      updateVisibility();
    })();
    return () => {
      disposed = true;
      if (frameId !== undefined) cancelAnimationFrame(frameId);
      releasePaint();
      releaseVisibility();
      visibility?.disconnect();
      keys.dispose();
      midi.dispose();
      if (initialized && application) {
        // Pixi Container.removeChild detaches a reusable container, not a DOM node.
        // eslint-disable-next-line unicorn/prefer-dom-node-remove
        application.stage.removeChild(keyboard.container);
        application.destroy(true);
      }
    };
  }, [keyboard]);
  return (
    <div className="max-w-full overflow-x-auto">
      <canvas
        ref={reference}
        width={Math.ceil(
          (keyboard.groupedRnageKeys.white?.length ?? 0) *
            Keyboard.WHITE_KEY_WIDTH,
        )}
        height={Keyboard.WHITE_KEY_HEIGHT}
      />
    </div>
  );
}
