"use client";
import { Button, Chip } from "@heroui/react";
import type {
  FixtureDefinition,
  Result,
} from "@/s-core/models/fixtures/manifest";
import { aggregateResults } from "@/s-core/models/fixtures/results";
import {
  documentRecords,
  evaluateAssertion,
} from "@/s-core/models/fixtures/evaluate";
import { svgRecords } from "@/s-core/models/browser/evaluate-fixture-svg";
import { debugAtom } from "@/store/debug";

import * as Core from "@/s-core/models/core";
import "@/s-core/models/core/extensions/to-sheet";
import { LayoutType, type Score } from "@/s-core/models/sheet";
import * as Engraving from "@/s-core/models/engraving";
import "@/s-core/models/document/extensions/to-svg";
import localFont from "next/font/local";
import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";

const bravura = localFont({
  src: [{ path: "../s-core/const/bravura/Bravura.woff" }],
});
const fixtureScale = 12;

export type Fixture = {
  name: string;
  definition?: FixtureDefinition;
  results?: Result[];
  reportError?: string;
} & (
  | { data: Record<string, unknown> }
  | { sheet: ReturnType<Score["export"]> }
  | { error: string }
  | { rejected: true }
  | { partial: true }
);

type RenderState =
  | { status: "loading" }
  | { status: "ready"; results?: Result[] }
  | { status: "error"; message: string };

export function ScoreFixtureGallery({ fixtures }: { fixtures: Fixture[] }) {
  const [debug, setDebug] = useAtom(debugAtom);
  return (
    <>
      <Button
        type="button"
        aria-pressed={debug}
        onClick={() => setDebug((value) => !value)}
        className="mb-4 rounded border px-3 py-2"
      >
        debug: {debug ? "ON" : "OFF"}
      </Button>
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
    let controller: Engraving.Controller | undefined;
    try {
      if ("error" in fixture) throw new Error(fixture.error);
      if ("rejected" in fixture || "partial" in fixture) return;
      const data =
        "sheet" in fixture
          ? fixture.sheet
          : Core.Score.create(
              fixture.data as unknown as Parameters<
                typeof Core.Score.create
              >[0],
            )
              .toSheet()
              .export();
      const score = Engraving.Score.import(data);
      controller = new Engraving.Controller(score, {
        scale: fixture.definition?.layout?.scale ?? fixtureScale,
        layoutType:
          LayoutType[fixture.definition?.layout?.type ?? "Horizontal"],
        viewportWidth: fixture.definition?.layout?.viewportWidth,
        viewportHeight: fixture.definition?.layout?.viewportHeight,
        pageLayout: fixture.definition?.layout?.pageLayout,
        debug,
        advanced: true,
      });
      controller.mount();
      const document = controller.toDocument();
      const pages = document.pages.map((_, pageIndex) =>
        document.toSVG({
          scale: fixture.definition?.layout?.scale ?? fixtureScale,
          fontFamily: bravura.style.fontFamily,
          paddingBottom: 100,
          ...(pageIndex === 0 ? {} : { pageIndex }),
        }),
      );
      if (pages.some((svg) => !svg))
        throw new Error("Renderer returned no SVG");
      containerElement?.replaceChildren(...pages);
      let verifiedResults: Result[] = [];
      if (fixture.definition) {
        const records = documentRecords(document);
        const svg = svgRecords(pages);
        verifiedResults = fixture.definition.assertions
          .filter((a) => ["document", "svg"].includes(a.stage))
          .map((a) =>
            evaluateAssertion(
              fixture.definition!.id,
              a,
              a.stage === "svg" ? svg : records,
            ),
          );
      }
      // Report the outcome of synchronizing the external SVG renderer with the DOM.

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRenderState({ status: "ready", results: verifiedResults });
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

  const definition = fixture.definition;
  const liveResults =
    renderState.status === "ready" ? (renderState.results ?? []) : [];
  const results = [
    ...(fixture.results ?? []).filter(
      (r) =>
        !liveResults.some(
          (v) => v.assertionId === r.assertionId && v.stage === r.stage,
        ),
    ),
    ...liveResults,
  ];
  const verified = definition
    ? aggregateResults(definition, results)
    : "pending";

  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-gray-300 bg-white">
      {"partial" in fixture && (
        <p className="p-3">
          不完全候補：既知情報と診断を保持しています。譜面描画は非適用です。
        </p>
      )}
      <header className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-3">
        <h2 className="truncate font-medium">{fixture.name}</h2>
        <span
          className={
            renderState.status === "error"
              ? "shrink-0 text-sm font-medium text-red-700"
              : "shrink-0 text-sm text-gray-600"
          }
        >
          {"rejected" in fixture || "partial" in fixture
            ? "描画対象外"
            : renderState.status === "error"
              ? "Error"
              : renderState.status === "ready"
                ? "Rendered"
                : "Loading"}
        </span>
      </header>
      <div className="px-4 py-2 text-sm">
        <Chip size="sm">検証: {fixture.reportError ? "error" : verified}</Chip>
        {definition ? (
          <>
            <p>{definition.target}</p>
            <ul>
              {definition.assertions.map((a) => (
                <li key={a.id}>
                  {a.id}: {JSON.stringify(a.expected)} ·{" "}
                  {results.find((r) => r.assertionId === a.id)?.status ??
                    "pending"}
                </li>
              ))}
            </ul>
            <ul>
              {definition.visualChecklist.map((a) => (
                <li key={a.id}>
                  目視: {a.expected} ·{" "}
                  {results.find((r) => r.assertionId === a.id)?.status ??
                    "pending"}
                </li>
              ))}
            </ul>
            {results
              .filter((r) => ["fail", "error"].includes(r.status))
              .map((r) => (
                <p key={r.assertionId} className="text-red-700">
                  {r.stage}/{r.assertionId}: {r.message}
                </p>
              ))}
          </>
        ) : (
          <p>記号の期待条件は未登録です。</p>
        )}
        {fixture.reportError && (
          <p className="text-red-700">{fixture.reportError}</p>
        )}
        {"rejected" in fixture && (
          <p>
            期待される拒否: {definition?.rejectionStage}。描画は適用外です。
          </p>
        )}
      </div>
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
