import * as d3 from "d3";
import * as R from "remeda";
import * as SMUFL from "../../smufl";
import * as Sheet from "../../sheet";
import { match, P } from "ts-pattern";
import { first, last } from "remeda";

declare module ".." {
  interface Score {
    toSVG: (options: { ratio: number; scale: number }) => SVGSVGElement | null;
  }
}

let svg: d3.Selection<SVGSVGElement, undefined, null, undefined> | null = null;
SMUFL.Score.prototype.toSVG = function (this: SMUFL.Score, options) {
  const ligatureToSVG = (
    element: d3.BaseType | SVGGElement,
    ligature: Sheet.Ligature
  ) => {
    const group = d3
      .select(element)
      .selectAll("g[type=ligature]")
      .data([ligature])
      .join("g")
      .attr("type", "ligature")
      .attr(
        "transform",
        `translate(${ligature.boundingBox.x}, ${-ligature.line})`
      )
      .attr("attr", JSON.stringify(ligature.attributes))
      .attr("width", ligature.width)
      .call((g) => {
        g.selectAll("g[type=children]")
          .data(ligature.children.flat())
          .join("g")
          .attr("type", "children")
          .each(function (children) {
            const g = d3.select(this);
            match(children)
              .with(P.instanceOf(SMUFL.Glyph), (glyph) =>
                g
                  .selectAll("text")
                  .data([glyph])
                  .join("text")
                  .attr("type", "glyph")
                  .attr("x", glyph.boundingBox.x)
                  .attr("y", -glyph.line)
                  .attr("width", glyph.width)
                  .attr("fill", ligature.style.color ?? "")
                  .text(String.fromCodePoint(glyph.codepoint))
              )
              .with(P.instanceOf(Sheet.Ligature), (childLigature) => {
                // TODO: このまーじはここですべきではない
                childLigature.style = {
                  ...childLigature.style,
                  ...ligature.style,
                };
                ligatureToSVG(g.node() as SVGGElement, childLigature);
              });
          });
      });
    ligature.onStyleChange = () => {
      group.attr("fill", ligature.style.color ?? "");
    };
  };

  svg ??= d3.create("svg");
  svg
    .attr("font-size", options.ratio)
    .attr("viewBox", `0 0 ${this.width} ${this.height}`)
    .attr("height", this.height * options.scale)
    .attr("width", this.width * options.scale)
    .selectAll("g[type=score]")
    .data([this])
    .join("g")
    .attr("type", "score")
    .attr("transform", createTranslate(0, 17))
    .each(function (score) {
      const g = d3.select(this);
      g.selectAll("g[type=row]")
        .data(score.rows)
        .join("g")
        .attr("type", "row")
        .attr("transform", (row) => createTranslate(0, row.y))
        .each(function (row) {
          const g = d3.select(this);
          g.selectAll("g[type=masterbar]")
            .data(row.masterbars)
            .join("g")
            .attr("type", "masterbar")
            .attr("transform", (masterbar) => createTranslate(masterbar.x, 0))
            .each(function (masterbar) {
              const g = d3.select(this);
              g.selectAll("g[type=track]")
                .data(masterbar.score.tracks)
                .join("g")
                .attr("type", "track")
                .attr("transform", (track) => createTranslate(0, track.y))
                .each(function (track) {
                  const g = d3.select(this);
                  g.selectAll("g[type=bar]")
                    .data(track.getMasterbarBars(masterbar.id))
                    .join("g")
                    .attr("type", "bar")
                    .each(function (bar) {
                      const g = d3.select(this);
                      g.selectAll("g[type=barline]")
                        .data([null])
                        .join("g")
                        .attr("type", "barline")
                        .attr("transform", createTranslate(0, -11.5))
                        .each(function () {
                          const g = d3.select(this);
                          g.selectAll("path")
                            .data([null])
                            .join("path")
                            .attr(
                              "transform",
                              createTranslate(
                                SMUFL.BravuraMetadata.engravingDefaults
                                  .thinBarlineThickness / 2,
                                0
                              )
                            )
                            .attr("stroke", "black")
                            .attr(
                              "stroke-width",
                              SMUFL.BravuraMetadata.engravingDefaults
                                .thinBarlineThickness
                            )
                            .attr(
                              "d",
                              d3.line()([
                                [0, 0],
                                [0, bar.height],
                              ])
                            );
                          if (masterbar.isRowLast) {
                            g.selectAll("path")
                              .data([null])
                              .join("path")
                              .attr(
                                "transform",
                                createTranslate(
                                  -(
                                    SMUFL.BravuraMetadata.engravingDefaults
                                      .thinBarlineThickness / 2
                                  ),
                                  0
                                )
                              )
                              .attr("stroke", "black")
                              .attr(
                                "stroke-width",
                                SMUFL.BravuraMetadata.engravingDefaults
                                  .thinBarlineThickness
                              )
                              .attr(
                                "d",
                                d3.line()([
                                  [masterbar.width, 0],
                                  [masterbar.width, bar.height],
                                ])
                              );
                          }
                          if (masterbar.isLast) {
                            g.selectAll("path")
                              .data([null])
                              .join("path")
                              .attr(
                                "transform",
                                createTranslate(
                                  -SMUFL.BravuraMetadata.engravingDefaults
                                    .thickBarlineThickness * 2,
                                  0
                                )
                              )
                              .attr("stroke", "black")
                              .attr(
                                "stroke-width",
                                SMUFL.BravuraMetadata.engravingDefaults
                                  .thinBarlineThickness
                              )
                              .attr(
                                "d",
                                d3.line()([
                                  [masterbar.width, 0],
                                  [masterbar.width, bar.height],
                                ])
                              );
                            g.selectAll("path")
                              .data([null])
                              .join("path")
                              .attr(
                                "transform",
                                createTranslate(
                                  -(
                                    SMUFL.BravuraMetadata.engravingDefaults
                                      .thickBarlineThickness / 2
                                  ),
                                  0
                                )
                              )
                              .attr("stroke", "black")
                              .attr(
                                "stroke-width",
                                SMUFL.BravuraMetadata.engravingDefaults
                                  .thickBarlineThickness
                              )
                              .attr(
                                "d",
                                d3.line()([
                                  [masterbar.width, 0],
                                  [masterbar.width, bar.height],
                                ])
                              );
                          }
                        });
                      g.selectAll("g[type=stave]")
                        .data(bar.staves)
                        .join("g")
                        .attr("type", "stave")
                        .attr("transform", (stave) =>
                          createTranslate(0, stave.y)
                        )
                        .each(function (stave) {
                          ligatureToSVG(this, stave.ligature);
                          const g = d3.select(this);
                          g.selectAll("g[type=beam]")
                            .data(stave.beams)
                            .join("g")
                            .attr("type", "beam")
                            /* .attr(
                              "transform",
                              createTranslate(
                                stave.metadataLigature?.width ?? 0,
                                0
                              )
                            ) */
                            .each(function (beam) {
                              const g = d3.select(this);
                              g.selectAll("path")
                                .data([beam])
                                .join("path")
                                .attr(
                                  "transform",
                                  createTranslate(
                                    0,
                                    -3 - // stem length
                                      SMUFL.BravuraMetadata.engravingDefaults
                                        .beamThickness /
                                        2
                                  )
                                )
                                .attr("stroke", "black")
                                .attr(
                                  "stroke-width",
                                  SMUFL.BravuraMetadata.engravingDefaults
                                    .beamThickness
                                )
                                .attr(
                                  "d",
                                  d3.line()([
                                    [
                                      first(
                                        beam.notes
                                      )!.ligature?.boundingBox.toInset()
                                        .right ?? 0,
                                      -first(beam.notes)!.line +
                                        beam.level *
                                          (SMUFL.BravuraMetadata
                                            .engravingDefaults.beamThickness +
                                            SMUFL.BravuraMetadata
                                              .engravingDefaults.beamSpacing),
                                    ],
                                    [
                                      last(
                                        beam.notes
                                      )!.ligature?.boundingBox.toInset()
                                        .right ?? 0,
                                      -last(beam.notes)!.line +
                                        beam.level *
                                          (SMUFL.BravuraMetadata
                                            .engravingDefaults.beamThickness +
                                            SMUFL.BravuraMetadata
                                              .engravingDefaults.beamSpacing),
                                    ],
                                  ])
                                );
                            });
                          g.selectAll("g[type=staff]")
                            .data(R.times(5, () => null))
                            .join("g")
                            .attr("type", "staff")
                            .attr("transform", createTranslate(0, 0))
                            .each(function (_, index) {
                              const g = d3.select(this);
                              g.selectAll("path")
                                .data([null])
                                .join("path")
                                .attr("stroke", "black")
                                .attr(
                                  "stroke-width",
                                  SMUFL.BravuraMetadata.engravingDefaults
                                    .staffLineThickness
                                )
                                .attr(
                                  "d",
                                  d3.line()([
                                    [0, -(index + 1)],
                                    [masterbar.width, -(index + 1)],
                                  ])
                                );
                            });
                        });
                    });
                });
            });
        });
    });

  return svg.node();
};

function createTranslate(x: number, y: number) {
  return `translate(${x}, ${y})`;
}
