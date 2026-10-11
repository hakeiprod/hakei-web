import * as Sheet from "../../sheet";
import { Controller, Score } from "../engraving";

export type ToDocumentOptions = Partial<
  ConstructorParameters<typeof Controller>[1]
>;

/** Engrave a detached copy of a sheet; the source retains only musical data. */
export function toDocument(
  sheet: Sheet.Score,
  options: ToDocumentOptions = {},
) {
  const score = Score.import(sheet.export());
  const controller = new Controller(score, {
    scale: 12,
    layoutType: Sheet.LayoutType.Horizontal,
    advanced: true,
    debug: false,
    ...options,
  });
  controller.mount();
  return controller.toDocument();
}
