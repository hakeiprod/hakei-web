"use client";
import { debugAtom } from "@/store/debug";

import * as Core from "@/s-core/models/core";
import "@/s-core/models/core/extensions/to-sheet";
import { LayoutType } from "@/s-core/models/sheet";
import * as SMUFL from "@/s-core/models/smufl";
import "@/s-core/models/document/extensions/to-svg";
import localFont from "next/font/local";
import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";

const bravura = localFont({
  src: [{ path: "../s-core/const/bravura/Bravura.woff" }],
});
const fixtureScale = 12;

type Fixture = {
  name: string;
  data: Record<string, unknown>;
};

type RenderState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

export function ScoreFixtureGallery({ fixtures }: { fixtures: Fixture[] }) {
  const [debug, setDebug] = useAtom(debugAtom);
  return (
    <>
      <button
        type="button"
        aria-pressed={debug}
        onClick={() => setDebug((value) => !value)}
        className="mb-4 rounded border px-3 py-2"
      >
        debug: {debug ? "ON" : "OFF"}
      </button>
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        {fixtures.map((fixture) => (
          <ScoreFixtureCard
            key={fixture.name}
            fixture={fixture}
            debug={debug}
          />
        ))}
      </div>
    </>
  );
}

function ScoreFixtureCard({
  fixture,
  debug,
}: {
  fixture: Fixture;
  debug: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [renderState, setRenderState] = useState<RenderState>({
    status: "loading",
  });

  useEffect(() => {
    const containerElement = container.current;
    let controller: SMUFL.Controller | undefined;
    try {
      const sheet = Core.Score.create(
        fixture.data as unknown as Parameters<typeof Core.Score.create>[0],
      ).toSheet();
      const score = SMUFL.Score.import(sheet.export());
      controller = new SMUFL.Controller(score, {
        scale: fixtureScale,
        layoutType: LayoutType.Horizontal,
        debug,
        advanced: true,
      });
      controller.mount();
      const document = controller.toDocument();
      const svg = document.toSVG({
        scale: fixtureScale,
        fontFamily: bravura.style.fontFamily,
        paddingBottom: 100,
      });
      if (!svg) throw new Error("Renderer returned no SVG");

      containerElement?.replaceChildren(svg);
      setRenderState({ status: "ready" });
    } catch (error) {
      setRenderState({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }

    return () => {
      controller?.unmount();
      containerElement?.replaceChildren();
    };
  }, [fixture, debug]);

  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-gray-300 bg-white">
      <header className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-3">
        <h2 className="truncate font-medium">{fixture.name}</h2>
        <span
          className={
            renderState.status === "error"
              ? "shrink-0 text-sm font-medium text-red-700"
              : "shrink-0 text-sm text-gray-600"
          }
        >
          {renderState.status === "error"
            ? "Error"
            : renderState.status === "ready"
              ? "Rendered"
              : "Loading"}
        </span>
      </header>
      {renderState.status === "error" ? (
        <pre className="overflow-auto whitespace-pre-wrap p-4 text-sm text-red-800">
          {renderState.message}
        </pre>
      ) : (
        <div
          ref={container}
          className={`${bravura.className} min-h-28 overflow-x-auto p-4`}
        />
      )}
    </article>
  );
}
