import { LayoutType, Score as SheetScore } from "../sheet";
import { Score, Controller } from "../engraving";
import { sheetScoreSchema } from "../import/score-schema";
import type { FixtureDefinition } from "./manifest";
export function prepareFixture(candidate: unknown, fixture: FixtureDefinition) {
  const data = sheetScoreSchema.parse(candidate);
  const score = Score.import(
    data as unknown as ReturnType<SheetScore["export"]>,
  );
  const layout = fixture.layout;
  if (!layout) throw new Error("Fixture layout missing");
  const controller = new Controller(score, {
    scale: layout.scale,
    layoutType: LayoutType[layout.type],
    debug: false,
    advanced: true,
    viewportWidth: layout.viewportWidth,
    viewportHeight: layout.viewportHeight,
    pageLayout: layout.pageLayout,
  });
  controller.mount();
  return { controller, score, document: controller.toDocument() };
}
