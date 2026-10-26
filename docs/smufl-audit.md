# SMuFL rendering audit — Issue #60

Reviewed develop at `8941b5c5f62c11421aa6c40a2e2445debd74124c` on 2026-10-26, plus the final barline correction in this PR. Unrelated local rendering changes are excluded.

Reference: https://smufl.formats.music/latest/specification/engravingdefaults.html

## Findings

- `engraving/extensions/to-document.ts` uses metadata for staff, stem, beam, thin barline and thick barline thickness. Secondary beams use beam thickness plus the metadata edge gap.
- `engraving/glyph.ts` obtains glyph bounds, advance widths and optional anchors from `smufl/metadata.ts`. `engraving/geometry.ts` uses notehead stem anchors, converts positive-up font coordinates to drawing coordinates, and accounts for the stroke centre. Missing notehead anchors fall back to ink edges. Flag attachment anchors are also consumed.
- Fixed in this change: final barline spacing was derived from thick barline thickness. `barlineEndInset` now reserves the two stroke widths plus the metadata edge gap. It prefers `thinThickBarlineSeparation` and falls back to `barlineSeparation` for the bundled older metadata. Layout and drawing share this function. Regression tests check rendered ink edges with absent, zero and custom separation.
- Font switching is not currently supported end to end. `smufl/metadata.ts`, `engraving/geometry.ts` and `engraving/extensions/to-document.ts` import Bravura directly. SVG `fontFamily` only changes the font used to paint already computed geometry. Changing that option alone can mismatch bounds, anchors, advance widths and line defaults.
- `document/curve.ts` uses a fixed 0.12 control-point offset for ties; it does not consume `tieEndpointThickness` or `tieMidpointThickness`. The band tapers to zero at the endpoints. This requires a curve geometry change, not just substituting one constant.
- Ledger lines use the `legerLine` glyph and its font bounds/advance width (`engraving/chord.ts`), rather than primitives driven by `legerLineThickness` and `legerLineExtension`. This consumes font geometry but does not implement those engraving-default settings independently.
- Nominal stem lengths, beam hook length, tablature masking padding, tie arch and page/system spacing are layout policies. SMuFL does not supply all layout decisions; these calculations cannot simply be removed in favour of metadata.

## Remaining implementation scope

1. Introduce one font descriptor holding matching font identity, glyph metrics, anchors and engraving defaults; thread it through layout and drawing. Rebuild layout when it changes. Test a second set of metrics and optional metadata omissions.
2. Make tie band geometry use endpoint and midpoint thickness defaults, with tests of the actual painted thickness.
3. Decide whether ledger lines should remain font glyphs or become primitives supporting the independent engraving defaults, including grace-note scaling.

The audit answers all four questions in #60: metadata is already used for major glyph and stroke geometry, arbitrary font switching is not yet safe, some manual calculations are necessary layout policy, and final barline spacing and tie thickness were the concrete metadata-related findings. The final barline finding is fixed here; the remaining implementation scope above is explicitly not claimed as implemented. This audit does not establish compatibility with arbitrary SMuFL fonts.

## Validation

`npx vitest run src/s-core/models/engraving/barline.test.ts src/s-core/models/engraving/extensions/to-document.test.ts`

Result: 2 files, 75 tests passed.

Broader regression: `npx vitest run src/s-core/models/engraving` — 11 files, 133 tests passed.

ESLint on the two changed TypeScript files and `git diff --check` passed.
