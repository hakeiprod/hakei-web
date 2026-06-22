import * as d3 from "d3";
import * as R from "remeda";
import { P, match } from "ts-pattern";
import { BoundingBox } from "../../boundingbox";
import * as Sheet from "../../sheet";
import * as SMUFL from "../../smufl";

declare module ".." {
  interface Score {
    toSVG: (
      options: Sheet.Controller["options"] & {
        ratio: number;
      },
    ) => SVGSVGElement | null;
  }
}

function lineToSVG(line: number) {
  return -(line - 5);
}
let svg: d3.Selection<SVGSVGElement, undefined, null, undefined> | null = null;
SMUFL.Score.prototype.toSVG = function (this: SMUFL.Score, options) {
  console.log(this);
  svg ??= d3.create("svg");
  const tooltip = new Tooltip(svg);
  function renderRect(
    ds: d3.BaseType | SVGGElement,
    boundingBox: BoundingBox,
    data: Record<string, unknown>,
    color: string,
  ) {
    const g = d3.select(ds);
    g.selectAll("rect")
      .data([null])
      .join("rect")
      .style("fill-opacity", 0)
      .style("stroke", color)
      .style("stroke-width", "0.1")
      .attr("width", () => boundingBox.width)
      .attr("height", () => boundingBox.height)
      .attr("x", boundingBox.x)
      .attr("y", boundingBox.y)
      .on("mouseenter", function () {
        d3.select(this).style("fill", color).style("fill-opacity", 0.25);
        tooltip.visible(JSON.stringify(data));
      })
      .on("mousemove", function (event) {
        tooltip.move(d3.pointer(event, svg?.node()));
      })
      .on("mouseleave", function () {
        d3.select(this).style("fill-opacity", 0);
        tooltip.invisible();
      });
  }
  function handleLigature(
    ds: d3.BaseType | SVGGElement,
    ligature: Sheet.Ligature<SMUFL.Glyph>,
  ) {
    const g = d3.select(ds);
    g?.selectAll("g[type=ligature]")
      .data([ligature])
      .join("g")
      .attr("type", "ligature")
      .attr("transform", createTranslate(ligature.x, 0))
      .attr("width", ligature.width)
      .call((g) => {
        g.selectAll("g[type=glyph]")
          .data(ligature.glyphLists.flat())
          .join("g")
          .attr("type", "glyph")
          .each(function (glyph) {
            const g = d3.select(this);
            g.selectAll("text")
              .data([glyph])
              .join("text")
              .attr("x", glyph.x)
              .attr("y", lineToSVG(glyph.line))
              .text(String.fromCodePoint(glyph.codepoint));
          });
      });
    ligature.onClassListChange = () => g.attr("class", ligature.classList);
  }
  function handleGlyph(ds: d3.BaseType | SVGGElement, glyph: SMUFL.Glyph) {
    const g = d3.select(ds);
    g.selectAll("g[type=glyph]")
      .data([glyph])
      .join("g")
      .attr("type", "glyph")
      .each(function (glyph) {
        const g = d3.select(this);
        g.selectAll("text")
          .data([glyph])
          .join("text")
          .attr("x", glyph.x + glyph.spaceLeft)
          .attr("y", lineToSVG(glyph.line))
          .text(String.fromCodePoint(glyph.codepoint));
      });
  }
  svg
    .attr("font-size", options.ratio)
    .attr("viewBox", `0 0 ${this.width} ${this.height}`)
    .attr("height", this.height * options.scale + 100)
    .attr("width", this.width * options.scale)
    .selectAll("g[type=score]")
    .data([this])
    .join("g")
    .attr("type", "score")
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
              if (options.debug)
                renderRect(
                  this,
                  {
                    width: masterbar.width,
                    height: masterbar.height,
                    x: 0,
                    y: 0,
                  },
                  masterbar.export(),
                  "red",
                );
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
                          const g = d3.select(this);
                          g.selectAll("g[type=word]")
                            .data([stave.word])
                            .join("g")
                            .attr("type", "word")
                            .each(function (word) {
                              for (const glyphOrLigatureList of word.glyphOrLigatureLists)
                                for (const glyphOrLigature of glyphOrLigatureList)
                                  match(glyphOrLigature)
                                    .with(
                                      P.instanceOf(Sheet.Ligature),
                                      (ligature) =>
                                        handleLigature(
                                          this,
                                          ligature as Sheet.Ligature<SMUFL.Glyph>,
                                        ),
                                    )
                                    .with(P.instanceOf(SMUFL.Glyph), (glyph) =>
                                      handleGlyph(this, glyph),
                                    )
                                    .exhaustive();
                            });
                          g.selectAll("g[type=slots]")
                            .data([stave])
                            .join("g")
                            .attr("type", "slots")
                            .attr(
                              "transform",
                              createTranslate(stave.word.width, 0),
                            )
                            .each(function () {
                              const g = d3.select(this);
                              g.selectAll("g[type=slot]")
                                .data(stave.slots)
                                .join("g")
                                .attr("type", "slot")
                                .attr("transform", (slot) =>
                                  createTranslate(slot.x, 0),
                                )
                                .each(function (slot) {
                                  const g = d3.select(this);
                                  if (options.debug)
                                    renderRect(
                                      this,
                                      {
                                        width: slot.width,
                                        height: slot.height,
                                        x: 0,
                                        y: 0,
                                      },
                                      slot.export(),
                                      "green",
                                    );
                                  g.selectAll("g[type=chord]")
                                    .data(
                                      slot.getTrackStaveChords(
                                        track.id,
                                        stave.id,
                                      ),
                                    )
                                    .join("g")
                                    .attr("type", "chord")
                                    .each(function (chord) {
                                      if (options.debug)
                                        renderRect(
                                          this,
                                          {
                                            width: chord.width,
                                            height: chord.height,
                                            x: 0,
                                            y: lineToSVG(chord.line) - 0.5,
                                          },
                                          chord.export(),
                                          "blue",
                                        );
                                      const g = d3.select(this);

                                      g.selectAll("g[type=note-glyph]")
                                        .data([null])
                                        .join("g")
                                        .attr("type", "note-glyph")
                                        .attr("transform", () =>
                                          createTranslate(0, 0),
                                        )
                                        .each(function () {
                                          const g = d3.select(this);
                                          g.selectAll("g[type=note]")
                                            .data(chord.notes)
                                            .join("g")
                                            .attr("type", "note")
                                            .each(function (note) {
                                              handleGlyph(this, note.glyph);
                                            });
                                        });
                                      g.selectAll("g[type=dots]")
                                        .data([null])
                                        .join("g")
                                        .attr("type", "dots")
                                        .each(function () {
                                          const g = d3.select(this);
                                          g.selectAll("g[type=dot]")
                                            .data(chord.notes)
                                            .join("g")
                                            .attr("type", "dot")
                                            .each(function (note) {
                                              handleLigature(
                                                this,
                                                note.dotLigature,
                                              );
                                            });
                                        });
                                      const x = match(chord.stem?._ ?? "none")
                                        .with(
                                          "up",
                                          () => chord.noteheadsLigature?.width,
                                        )
                                        .with(
                                          "down",
                                          () =>
                                            chord.noteheadsLigature?.x +
                                            chord.glyphAdvanceWidth,
                                        )
                                        .with("double", () => {
                                          throw new Error("wip");
                                        })
                                        .with("none", () => 0)
                                        .exhaustive();
                                      g.selectAll("path")
                                        .data([chord])
                                        .join("path")
                                        .attr("stroke", "black")
                                        .attr(
                                          "stroke-width",
                                          SMUFL.BravuraMetadata
                                            .engravingDefaults.stemThickness,
                                        )
                                        .attr(
                                          "d",
                                          d3.line()([
                                            [x, lineToSVG(chord.line)],
                                            [
                                              x,
                                              lineToSVG(chord.line) +
                                                match(chord.stem?._ ?? "none")
                                                  .with(
                                                    "up",
                                                    // () => -chord.stemLength,
                                                    () => -3,
                                                  )
                                                  .with(
                                                    "down",
                                                    // () => chord.stemLength,
                                                    () => 3,
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
                                });
                            });
                          g.selectAll("g[type=staff]")
                            .data(R.times(5, R.doNothing))
                            .join("g")
                            .attr("type", "staff")
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
                                    [0, index],
                                    [masterbar.width, index],
                                  ]),
                                );
                            });
                          const stemGlyph = new SMUFL.Glyph(
                            SMUFL.Glyph.find("stems", (v) =>
                              v.includes("stem"),
                            ),
                            Sheet.ElementType.Stem,
                            0,
                          );
                          g.selectAll("g[type=beam]")
                            .data(stave.beamGroups)
                            .join("g")
                            .attr("type", "beam")
                            .each(function (beamGroup) {
                              const { x1, x2 } = match(
                                beamGroup.firstChord.stem?._ ?? "none",
                              )
                                .with("up", () => ({
                                  x1: beamGroup.firstChord.right,
                                  x2: beamGroup.lastChord.right,
                                }))
                                .with("down", () => ({
                                  x1:
                                    beamGroup.firstChord.left +
                                    beamGroup.firstChord.glyphAdvanceWidth,
                                  x2:
                                    beamGroup.lastChord.left +
                                    beamGroup.lastChord.glyphAdvanceWidth,
                                }))
                                .with("double", () => {
                                  throw new Error("wip");
                                })
                                .with("none", () => ({ x1: 0, x2: 0 }))
                                .exhaustive();
                              const g = d3.select(this);
                              g.selectAll("path")
                                .data([beamGroup])
                                .join("path")
                                .attr(
                                  "transform",
                                  createTranslate(
                                    0,
                                    match(
                                      beamGroup.firstChord.stem?._ ?? "none",
                                    )
                                      .with(
                                        "up",
                                        () =>
                                          -stemGlyph.glyphBBox.height +
                                          SMUFL.BravuraMetadata
                                            .engravingDefaults.beamThickness *
                                            2,
                                      )
                                      .with(
                                        "down",
                                        () =>
                                          stemGlyph.glyphBBox.height -
                                          SMUFL.BravuraMetadata
                                            .engravingDefaults.beamThickness /
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
                                      stave.word.width +
                                        beamGroup.firstChord.slot.x +
                                        x1,
                                      lineToSVG(
                                        beamGroup.firstChord.line +
                                          beamGroup.level,
                                      ) *
                                        (SMUFL.BravuraMetadata.engravingDefaults
                                          .beamThickness +
                                          SMUFL.BravuraMetadata
                                            .engravingDefaults.beamSpacing),
                                    ],
                                    [
                                      stave.word.width +
                                        beamGroup.lastChord.slot.x +
                                        x2,
                                      lineToSVG(
                                        beamGroup.lastChord.line +
                                          beamGroup.level,
                                      ) *
                                        (SMUFL.BravuraMetadata.engravingDefaults
                                          .beamThickness +
                                          SMUFL.BravuraMetadata
                                            .engravingDefaults.beamSpacing),
                                    ],
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

class Tooltip {
  d3;
  constructor(svg: d3.Selection<SVGSVGElement, undefined, null, undefined>) {
    this.d3 = svg
      .append("g")
      .attr("type", "tooltip")
      .append("text")
      .attr("font-size", "2px")
      .attr("fill-opacity", 0);
  }
  visible(text: string) {
    this.d3.attr("fill-opacity", 1).text(text);
  }
  move([x, y]: ReturnType<typeof d3.pointer>) {
    this.d3.attr("transform", () => createTranslate(x, y));
  }
  invisible() {
    this.d3.attr("fill-opacity", 0).text();
  }
}
