import BravuraMetadata from "../../const/bravura/bravura_metadata.json";
import Glyphnames from "../../const/smufl/glyphnames.json";

export * from "./bar";
export * from "./controller";
export * from "./glyph";
export * from "./masterbar";
export * from "./note";
export * from "./row";
export * from "./score";
export * from "./stave";
export * from "./timesignature";
export * from "./track";

export const getGlyphBBox = (glyphName: keyof Glyphnames) =>
  BravuraMetadata.glyphBBoxes[
    glyphName as keyof (typeof BravuraMetadata)["glyphBBoxes"]
  ];
export const getGlyphAdvanceWidth = (glyphName: keyof Glyphnames) =>
  BravuraMetadata.glyphAdvanceWidths[
    glyphName as keyof (typeof BravuraMetadata)["glyphAdvanceWidths"]
  ];
export const getGlyphWithAnchor = <T extends keyof Glyphnames>(glyphName: T) =>
  BravuraMetadata.glyphsWithAnchors[
    glyphName as keyof BravuraMetadata["glyphsWithAnchors"]
  ];

export { default as BravuraMetadata } from "../../const/bravura/bravura_metadata.json";
export { default as Glyphnames } from "../../const/smufl/glyphnames.json";
export { default as Ranges } from "../../const/smufl/ranges.json";
