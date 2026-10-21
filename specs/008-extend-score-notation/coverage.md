# Fixture Coverage

69 fixtures。各入力は主条件1つを持つ。判定器の対照結果は notation.test.ts、evaluate.test.ts、notation-ties-svg.test.ts 等で検証する。

## 受け入れ条件と最小 fixtures

| 条件 | fixture ID |
| --- | --- |
| US1/AC1 | notehead/whole, rest/whole, notehead/half, rest/half, notehead/quarter, rest/quarter, notehead/eighth, rest/eighth, notehead/16th, rest/16th, dot/single, stem/up, flag/up, stem/down, flag/down, beam/primary, beam/forward-hook, beam/backward-hook, chord/triad, ledger/low, ledger/high, clef/G, clef/F, key/1, key/-1, meter/4-4, meter/change, barline/start, barline/final, staff/multiple |
| US1/AC2 | notehead/quarter |
| US1/AC3 | notehead/whole, rest/whole, rest/half, rest/quarter, rest/eighth, rest/16th |
| US2/AC1 | tie/same-bar, tie/cross-bar, tie/chain, tie/visual-only, tie/musical-fallback, tie/mismatch, tie/compressed, tie/numbered, tie/enharmonic |
| US2/AC2 | tie/chord-member |
| US2/AC3 | tie/system-break, tie/page-break |
| US2/AC4 | tie/chain, tie/visual-only, tie/musical-fallback |
| US2/AC5 | tie/voice-isolation, tie/staff-isolation, tie/part-isolation, tie/missing-endpoint, tie/ambiguous-unison |
| US3/AC1 | accidental/sharp, accidental/flat, accidental/natural, accidental/double-sharp, accidental/double-flat, accidental/enharmonic-spelling, accidental/tie-continuation, accidental/chord-neighbors, accidental/ledger-position, accidental/compressed-source, accidental/reject-pitch |
| US3/AC2 | accidental/repeat-in-bar, accidental/reset-next-bar, accidental/key-change |
| US3/AC3 | accidental/explicit-cautionary, accidental/parentheses |
| US3/AC4 | accidental/voice-sharing, accidental/octave-isolation, accidental/staff-isolation, accidental/part-isolation, accidental/simultaneous-conflict |

## 機能要件・成功基準とタスク

タスク割当は [tasks.md](tasks.md) の Requirement Coverage を正とする。以下は実行段階の分類。

| 要件 | 検証と現状 |
| --- | --- |
| FR-001 | 単体・SVG・スキーマ・UI／loaderの回帰で検証。 |
| FR-002 | 単体・SVG・スキーマ・UI／loaderの回帰で検証。 |
| FR-003 | 単体・SVG・スキーマ・UI／loaderの回帰で検証。 |
| FR-004 | 単体・SVG・スキーマ・UI／loaderの回帰で検証。実保存・取得は専用DB未設定のため未実施。 |
| FR-005 | 単体・SVG・スキーマ・UI／loaderの回帰で検証。実ブラウザーの形状確認は未実施。 |
| FR-006 | 単体・SVG・スキーマ・UI／loaderの回帰で検証。 |
| FR-007 | 単体・SVG・スキーマ・UI／loaderの回帰で検証。実ブラウザーの形状確認は未実施。 |
| FR-008 | 単体・SVG・スキーマ・UI／loaderの回帰で検証。 |
| FR-009 | 単体・SVG・スキーマ・UI／loaderの回帰で検証。 |
| FR-010 | 単体・SVG・スキーマ・UI／loaderの回帰で検証。 |
| FR-011 | 単体・SVG・スキーマ・UI／loaderの回帰で検証。実ブラウザーの形状確認は未実施。 |
| FR-012 | 単体・SVG・スキーマ・UI／loaderの回帰で検証。実ブラウザーの形状確認は未実施。 |
| FR-013 | 単体・SVG・スキーマ・UI／loaderの回帰で検証。 |
| FR-014 | 単体・SVG・スキーマ・UI／loaderの回帰で検証。実ブラウザーの形状確認は未実施。 |
| FR-015 | 単体・SVG・スキーマ・UI／loaderの回帰で検証。実保存・取得は専用DB未設定のため未実施。 |
| FR-016 | 単体・SVG・スキーマ・UI／loaderの回帰で検証。 |
| FR-017 | 単体・SVG・スキーマ・UI／loaderの回帰で検証。実ブラウザーの形状確認は未実施。 |
| SC-001 | 対応する自動検証は合格。全体完了は残る必須検証後。 |
| SC-002 | 未完了：実保存・取得と実ブラウザーの確認を含む。 |
| SC-003 | 未完了：実保存・取得と実ブラウザーの確認を含む。 |
| SC-004 | 対応する自動検証は合格。全体完了は残る必須検証後。 |
| SC-005 | 対応する自動検証は合格。全体完了は残る必須検証後。 |
| SC-006 | 未完了：実保存・取得と実ブラウザーの確認を含む。 |

## 段階別の扱い

- render は宣言した requiredStages 全てを検証。正常タイ・臨時記号は persisted/visual が未検証なので全体合格にはしない。
- reject は拒否を期待する段階のみ。reject/unsupported-version は入力拒否を自動確認。accidental/reject-pitch はDB側保存拒否のため未実施。
- visual-results.json は実際の目視記録がまだないため作成していない。
- verification-results.json の各結果は入力・期待値・レイアウト・rendererRevision が現行値に一致する場合だけ採用する。
