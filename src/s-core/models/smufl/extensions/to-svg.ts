import * as d3 from "d3";
import * as R from "remeda";
import { match, P } from "ts-pattern";
import * as Sheet from "../../sheet";
import * as SMUFL from "../../smufl";

declare module ".." {
  interface Score {
    toSVG: (options: { ratio: number; scale: number }) => SVGSVGElement | null;
  }
}

let svg: d3.Selection<SVGSVGElement, undefined, null, undefined> | null = null;
SMUFL.Score.prototype.toSVG = function (this: SMUFL.Score, options) {
  const ligatureToSVG = (
    element: d3.BaseType | SVGGElement,
    ligature: Sheet.Ligature,
  ) => {
    const group = d3
      .select(element)
      .selectAll("g[type=ligature]")
      .data([ligature])
      .join("g")
      .attr("type", "ligature")
      .attr(
        "transform",
        `translate(${ligature.boundingBox.x}, ${-ligature.line})`,
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
                  .text(String.fromCodePoint(glyph.codepoint)),
              )
              .with(P.instanceOf(Sheet.Ligature), (childLigature) => {
                ligatureToSVG(g.node() as SVGGElement, childLigature);
              });
          });
      });
    ligature.onClassListChange = () => {
      group.attr("class", ligature.classList);
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
                          g.selectAll("path[position=start]")
                            .data([null])
                            .join("path")
                            .attr("position", "start")
                            .attr(
                              "transform",
                              createTranslate(
                                SMUFL.BravuraMetadata.engravingDefaults
                                  .thinBarlineThickness / 2,
                                0,
                              ),
                            )
                            .attr("stroke", "black")
                            .attr(
                              "stroke-width",
                              SMUFL.BravuraMetadata.engravingDefaults
                                .thinBarlineThickness,
                            )
                            .attr(
                              "d",
                              d3.line()([
                                [0, 0],
                                [0, bar.height],
                              ]),
                            );
                          if (masterbar.isRowLast) {
                            g.selectAll("path[position=end]")
                              .data([null])
                              .join("path")
                              .attr("position", "end")
                              .attr(
                                "transform",
                                createTranslate(
                                  -(
                                    SMUFL.BravuraMetadata.engravingDefaults
                                      .thinBarlineThickness / 2
                                  ),
                                  0,
                                ),
                              )
                              .attr("stroke", "black")
                              .attr(
                                "stroke-width",
                                SMUFL.BravuraMetadata.engravingDefaults
                                  .thinBarlineThickness,
                              )
                              .attr(
                                "d",
                                d3.line()([
                                  [masterbar.width, 0],
                                  [masterbar.width, bar.height],
                                ]),
                              );
                          }
                          if (masterbar.isLast) {
                            g.selectAll("path[position=end]")
                              .data([null])
                              .join("path")
                              .attr("position", "end")
                              .attr(
                                "transform",
                                createTranslate(
                                  -SMUFL.BravuraMetadata.engravingDefaults
                                    .thickBarlineThickness * 2,
                                  0,
                                ),
                              )
                              .attr("stroke", "black")
                              .attr(
                                "stroke-width",
                                SMUFL.BravuraMetadata.engravingDefaults
                                  .thinBarlineThickness,
                              )
                              .attr(
                                "d",
                                d3.line()([
                                  [masterbar.width, 0],
                                  [masterbar.width, bar.height],
                                ]),
                              );
                            g.selectAll("path[position=end]")
                              .data([null])
                              .join("path")
                              .attr("position", "end")
                              .attr(
                                "transform",
                                createTranslate(
                                  -(
                                    SMUFL.BravuraMetadata.engravingDefaults
                                      .thickBarlineThickness / 2
                                  ),
                                  0,
                                ),
                              )
                              .attr("stroke", "black")
                              .attr(
                                "stroke-width",
                                SMUFL.BravuraMetadata.engravingDefaults
                                  .thickBarlineThickness,
                              )
                              .attr(
                                "d",
                                d3.line()([
                                  [masterbar.width, 0],
                                  [masterbar.width, bar.height],
                                ]),
                              );
                          }
                        });
                      g.selectAll("g[type=stave]")
                        .data(bar.staves)
                        .join("g")
                        .attr("type", "stave")
                        .attr("transform", (stave) =>
                          createTranslate(0, stave.y),
                        )
                        .each(function (stave) {
                          ligatureToSVG(this, stave.ligature);
                          const g = d3.select(this);
                          g.selectAll("g[type=decoration]")
                            .data([stave])
                            .join("g")
                            .attr("type", "decoration")
                            .attr(
                              "transform",
                              createTranslate(
                                (() => {
                                  const ligatures = [];
                                  if (stave.bar.masterbar.isRowFirst)
                                    ligatures.push(stave.ligature.children[0]);
                                  if (stave.bar.masterbar.isFirst)
                                    ligatures.push(
                                      stave.ligature.children[1],
                                      stave.ligature.children[2],
                                    );
                                  return ligatures
                                    .flat()
                                    .reduce(
                                      (accumulator, current) =>
                                        accumulator + current.width,
                                      0,
                                    );
                                })(),
                                0,
                              ),
                            )
                            .call((g) => {
                              const stemGlyph = new SMUFL.Glyph(
                                SMUFL.Glyph.find("stems", (v) =>
                                  v.includes("stem"),
                                ),
                                Sheet.ElementType.Stem,
                              );
                              g.selectAll("g[type=stem]")
                                .data(stave.notes)
                                .join("g")
                                .attr("type", "stem")
                                .each(function (note) {
                                  const g = d3.select(this);
                                  const x = match(note.stem?._ ?? "none")
                                    .with(
                                      "up",
                                      () =>
                                        note.ligature.boundingBox.toInset()
                                          .right,
                                    )
                                    .with(
                                      "down",
                                      () =>
                                        note.ligature.boundingBox.toInset()
                                          .left,
                                    )
                                    .with("double", () => {
                                      throw new Error("wip");
                                    })
                                    .with("none", () => 0)
                                    .exhaustive();
                                  g.selectAll("path")
                                    .data([note])
                                    .join("path")
                                    .attr("stroke", "black")
                                    .attr(
                                      "stroke-width",
                                      SMUFL.BravuraMetadata.engravingDefaults
                                        .stemThickness,
                                    )
                                    .attr(
                                      "d",
                                      d3.line()([
                                        [x, -note.line],
                                        [
                                          x,
                                          -note.line +
                                            match(note.stem?._ ?? "none")
                                              .with(
                                                "up",
                                                () => -note.stemLength,
                                              )
                                              .with(
                                                "down",
                                                () => note.stemLength,
                                              )
                                              .with("double", () => {
                                                throw new Error("wip");
                                              })
                                              .with("none", () => 0)
                                              .exhaustive(),
                                        ],
                                      ]),
                                    );
                                });
                              g.selectAll("g[type=beam]")
                                .data(stave.beamGroups)
                                .join("g")
                                .attr("type", "beam")
                                .each(function (beamGroup) {
                                  const g = d3.select(this);
                                  const { x1, x2 } = match(
                                    beamGroup.firstNote.stem?._ ?? "none",
                                  )
                                    .with("up", () => ({
                                      x1:
                                        beamGroup.firstNote.ligature?.boundingBox.toInset()
                                          .right ?? 0,
                                      x2:
                                        beamGroup.lastNote.ligature?.boundingBox.toInset()
                                          .right ?? 0,
                                    }))
                                    .with("down", () => ({
                                      x1:
                                        beamGroup.firstNote.ligature?.boundingBox.toInset()
                                          .left ?? 0,
                                      x2:
                                        beamGroup.lastNote.ligature?.boundingBox.toInset()
                                          .left ?? 0,
                                    }))
                                    .with("double", () => {
                                      throw new Error("wip");
                                    })
                                    .with("none", () => ({ x1: 0, x2: 0 }))
                                    .exhaustive();

                                  g.selectAll("path")
                                    .data([beamGroup])
                                    .join("path")
                                    .attr(
                                      "transform",
                                      createTranslate(
                                        0,
                                        match(
                                          beamGroup.firstNote.stem?._ ?? "none",
                                        )
                                          .with(
                                            "up",
                                            () =>
                                              -stemGlyph.glyphBBox.height +
                                              SMUFL.BravuraMetadata
                                                .engravingDefaults
                                                .beamThickness /
                                                2,
                                          )
                                          .with(
                                            "down",
                                            () =>
                                              stemGlyph.glyphBBox.height -
                                              SMUFL.BravuraMetadata
                                                .engravingDefaults
                                                .beamThickness /
                                                2,
                                          )
                                          .with("double", () => {
                                            throw new Error("wip");
                                          })
                                          .with("none", () => 0)
                                          .exhaustive(),
                                      ),
                                    )
                                    .attr("stroke", "black")
                                    .attr(
                                      "stroke-width",
                                      SMUFL.BravuraMetadata.engravingDefaults
                                        .beamThickness,
                                    )
                                    .attr(
                                      "d",
                                      d3.line()([
                                        [
                                          x1,
                                          -beamGroup.firstNote.line +
                                            beamGroup.level *
                                              (SMUFL.BravuraMetadata
                                                .engravingDefaults
                                                .beamThickness +
                                                SMUFL.BravuraMetadata
                                                  .engravingDefaults
                                                  .beamSpacing),
                                        ],
                                        [
                                          x2,
                                          -beamGroup.lastNote.line +
                                            beamGroup.level *
                                              (SMUFL.BravuraMetadata
                                                .engravingDefaults
                                                .beamThickness +
                                                SMUFL.BravuraMetadata
                                                  .engravingDefaults
                                                  .beamSpacing),
                                        ],
                                      ]),
                                    );
                                });
                            });
                          g.selectAll("g[type=staff]")
                            .data(R.times(5, R.doNothing))
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
                                    .staffLineThickness,
                                )
                                .attr(
                                  "d",
                                  d3.line()([
                                    [0, -(index + 1)],
                                    [masterbar.width, -(index + 1)],
                                  ]),
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
