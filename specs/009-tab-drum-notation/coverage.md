# Coverage: TAB・ドラム譜

109件の独立fixtures。各記号と条件を個別判定し、入力・モデル往復・Document・SVGと実保存取得・実ブラウザーを分離する。以下は割当であり、DB／目視成功の主張ではない。実行結果はverification-results.jsonとvalidation.mdを参照する。

| 要件 | fixture / assertion | タスク |
| --- | --- | --- |
| FR-001 | mixed/normal-tab、mixed/all-three、tab/4-string-position-1（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T008, T019, T021, T048 |
| FR-002 | tab/6-string-position-1、tab/6-string-position-2、tab/6-string-position-3、tab/6-string-position-4、tab/6-string-position-5、tab/6-string-position-6、tab/4-string-position-1、tab/4-string-position-2、tab/4-string-position-3、tab/4-string-position-4、tab/fret-0、tab/fret-9、tab/fret-10、tab/fret-36、tab/simultaneous-strings（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T007, T019, T022, T027 |
| FR-003 | tab/same-pitch-different-fingering、tab/tuning-explicit、tab/no-tuning（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T003, T008, T016, T019, T027, T028 |
| FR-004 | tab/duration-whole、tab/duration-half、tab/duration-quarter、tab/duration-eighth、tab/duration-16th、tab/dotted、tab/stem-up、tab/stem-down、tab/flag-up、tab/flag-down、tab/beam、tab/forward-hook、tab/backward-hook、tab/tie-same-bar、tab/tie-cross-bar、tab/tie-system-break、tab/tie-page-break（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T024, T025, T028, T042 |
| FR-005 | tab/fret-0、tab/fret-10、tab/fret-36、tab/simultaneous-strings（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T023, T026, T052 |
| FR-006 | drum/kick、drum/snare、drum/closed-hihat、drum/pedal-hihat、drum/high-tom、drum/mid-tom、drum/floor-tom、drum/crash、drum/ride、drum/normal-whole、drum/normal-half、drum/normal-quarter、drum/x-whole、drum/x-half、drum/x-quarter（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T040, T041, T045 |
| FR-007 | drum/position-independent、drum/unknown-instrument、drum/snare（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T009, T034, T037, T039 |
| FR-008 | drum/voices、drum/simultaneous、drum/dotted、drum/stem-up、drum/stem-down、drum/flag-up、drum/flag-down、drum/beam、drum/forward-hook、drum/backward-hook、drum/rest-null-whole、drum/rest-null-half、drum/rest-null-quarter、drum/rest-null-eighth、drum/rest-null-16th、drum/legacy-numeric-rest（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T024, T028, T035, T042 |
| FR-009 | drum/unknown-instrument、drum/unsupported-head、drum/missing-position、tab/unsupported-technique、tab/unsupported-strings、mixed/unknown-normal-pitch（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T005, T010, T011, T030, T038, T044, T049, T054 |
| FR-010 | mixed/explicit-shared-event、mixed/normal-tab、tab/no-sounding-pitch、drum/snare（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T010, T031, T049 |
| FR-011 | mixed/normal-tab、mixed/normal-drums、mixed/all-three、mixed/four-line-first、mixed/six-line-first、mixed/track-four-first、mixed/track-six-first、mixed/headers、mixed/explicit-shared-event、mixed/systems、mixed/pages、tab/tie-system-break、tab/tie-page-break（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T028, T046, T048, T051 |
| FR-012 | reject/string-zero、reject/string-outside、reject/fret-negative、reject/fret-fraction、reject/fret-outside、reject/kind-conflict、reject/rest-with-tie、reject/rest-with-head、reject/invalid-shared-event、tab/compressed、drum/compressed、drum/legacy-numeric-rest（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T015, T018, T036, T054, T056, T058 |
| FR-013 | 全109 fixture（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T002, T027, T028, T041, T042, T051, T061, T062 |
| FR-014 | 全109 fixture（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T012, T027, T041, T052, T062 |
| FR-015 | 全render fixture（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T017, T028, T029, T035, T042, T052, T061 |
| FR-016 | tab/unsupported-strings、drum/unsupported-head、reject/string-zero、mixed/pages（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T006, T014, T053, T055, T062 |
| FR-017 | mixed/explicit-shared-event、drum/rest-null-quarter、mixed/pages（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T015, T025, T044, T057 |
| SC-001 | 全109 fixture（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T002, T052, T062 |
| SC-002 | 全render fixture（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T018, T036, T054, T058 |
| SC-003 | 全render fixture（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T032, T033, T044, T045, T055 |
| SC-004 | 全109 fixture（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T017, T029, T035, T042, T049, T052, T061 |
| SC-005 | mixed/explicit-shared-event、mixed/normal-tab、drum/rest-null-quarter（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T015, T044, T050, T057 |
| SC-006 | tab/unsupported-strings、tab/missing-string、drum/unsupported-head、drum/missing-position、tab/invalid-string-input、tab/conflicting-string-input、mixed/unknown-normal-pitch、tab/unsupported-technique、drum/unknown-instrument（各fixtureのstage別assertion ID。position / primary / staff-gap / tie を含む） | T005, T010, T011, T030, T037, T038, T043, T049, T054 |

## 独立条件の一覧

| Fixture | 主対象 | 適用段階 | 受け入れ条件 |
| --- | --- | --- | --- |
| tab/6-string-position-1 | tab/6-string-position-1: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC1 |
| tab/6-string-position-2 | tab/6-string-position-2: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC2 |
| tab/6-string-position-3 | tab/6-string-position-3: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC3 |
| tab/6-string-position-4 | tab/6-string-position-4: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC4 |
| tab/6-string-position-5 | tab/6-string-position-5: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC5 |
| tab/6-string-position-6 | tab/6-string-position-6: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC1 |
| tab/4-string-position-1 | tab/4-string-position-1: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC2 |
| tab/4-string-position-2 | tab/4-string-position-2: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC3 |
| tab/4-string-position-3 | tab/4-string-position-3: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC4 |
| tab/4-string-position-4 | tab/4-string-position-4: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC5 |
| tab/fret-0 | tab/fret-0: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC1 |
| tab/fret-9 | tab/fret-9: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC2 |
| tab/fret-10 | tab/fret-10: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC3 |
| tab/fret-36 | tab/fret-36: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC4 |
| tab/same-pitch-different-fingering | tab/same-pitch-different-fingering: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC5 |
| tab/simultaneous-strings | tab/simultaneous-strings: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC1 |
| tab/no-sounding-pitch | tab/no-sounding-pitch: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC2 |
| tab/no-tuning | tab/no-tuning: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC3 |
| tab/duration-whole | tab/duration-whole: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC4 |
| tab/rest-whole | tab/rest-whole: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC5 |
| tab/duration-half | tab/duration-half: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC1 |
| tab/rest-half | tab/rest-half: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC2 |
| tab/duration-quarter | tab/duration-quarter: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC3 |
| tab/rest-quarter | tab/rest-quarter: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC4 |
| tab/duration-eighth | tab/duration-eighth: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC5 |
| tab/rest-eighth | tab/rest-eighth: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC1 |
| tab/duration-16th | tab/duration-16th: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC2 |
| tab/rest-16th | tab/rest-16th: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC3 |
| tab/dotted | tab/dotted: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC4 |
| tab/stem-up | tab/stem-up: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC5 |
| tab/flag-up | tab/flag-up: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC1 |
| tab/stem-down | tab/stem-down: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC2 |
| tab/flag-down | tab/flag-down: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC3 |
| tab/beam | tab/beam: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC4 |
| tab/forward-hook | tab/forward-hook: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC5 |
| tab/backward-hook | tab/backward-hook: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC1 |
| tab/tie-same-bar | tab/tie-same-bar: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC2 |
| tab/tie-cross-bar | tab/tie-cross-bar: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC3 |
| tab/unsupported-technique | tab/unsupported-technique: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1, US1/AC4 |
| drum/kick | drum/kick: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC4 |
| drum/snare | drum/snare: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC1 |
| drum/closed-hihat | drum/closed-hihat: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC2 |
| drum/pedal-hihat | drum/pedal-hihat: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC3 |
| drum/high-tom | drum/high-tom: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC4 |
| drum/mid-tom | drum/mid-tom: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC1 |
| drum/floor-tom | drum/floor-tom: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC2 |
| drum/crash | drum/crash: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC3 |
| drum/ride | drum/ride: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC4 |
| drum/normal-whole | drum/normal-whole: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC1 |
| drum/normal-half | drum/normal-half: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC2 |
| drum/normal-quarter | drum/normal-quarter: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC3 |
| drum/x-whole | drum/x-whole: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC4 |
| drum/x-half | drum/x-half: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC1 |
| drum/x-quarter | drum/x-quarter: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC2 |
| drum/duration-whole | drum/duration-whole: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC3 |
| drum/rest-null-whole | drum/rest-null-whole: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC4 |
| drum/duration-half | drum/duration-half: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC1 |
| drum/rest-null-half | drum/rest-null-half: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC2 |
| drum/duration-quarter | drum/duration-quarter: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC3 |
| drum/rest-null-quarter | drum/rest-null-quarter: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC4 |
| drum/duration-eighth | drum/duration-eighth: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC1 |
| drum/rest-null-eighth | drum/rest-null-eighth: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC2 |
| drum/duration-16th | drum/duration-16th: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC3 |
| drum/rest-null-16th | drum/rest-null-16th: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC4 |
| drum/unknown-instrument | drum/unknown-instrument: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC1 |
| drum/position-independent | drum/position-independent: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC2 |
| drum/dotted | drum/dotted: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC3 |
| drum/stem-up | drum/stem-up: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC4 |
| drum/flag-up | drum/flag-up: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC1 |
| drum/stem-down | drum/stem-down: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC2 |
| drum/flag-down | drum/flag-down: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC3 |
| drum/simultaneous | drum/simultaneous: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC4 |
| drum/voices | drum/voices: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC1 |
| drum/beam | drum/beam: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC2 |
| drum/forward-hook | drum/forward-hook: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC3 |
| drum/backward-hook | drum/backward-hook: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC4 |
| tab/unsupported-strings | tab/unsupported-strings: 保持・診断 | import, roundtrip, persisted | US1/AC1, US1/AC2 |
| tab/missing-string | tab/missing-string: 保持・診断 | import, roundtrip, persisted | US1/AC1, US1/AC3 |
| drum/unsupported-head | drum/unsupported-head: 保持・診断 | import, roundtrip, persisted | US2/AC1, US2/AC3 |
| drum/missing-position | drum/missing-position: 保持・診断 | import, roundtrip, persisted | US2/AC1, US2/AC4 |
| tab/tuning-explicit | tab/tuning-explicit: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1 |
| tab/compressed | tab/compressed: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1 |
| drum/compressed | drum/compressed: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1 |
| tab/tie-system-break | tab/tie-system-break: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1 |
| tab/tie-page-break | tab/tie-page-break: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US1/AC1 |
| mixed/normal-tab | mixed/normal-tab: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US3/AC1, US3/AC2, US3/AC3 |
| mixed/normal-drums | mixed/normal-drums: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US3/AC1, US3/AC2, US3/AC3 |
| mixed/all-three | mixed/all-three: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US3/AC1, US3/AC2, US3/AC3 |
| mixed/four-line-first | mixed/four-line-first: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US3/AC1, US3/AC2, US3/AC3 |
| mixed/six-line-first | mixed/six-line-first: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US3/AC1, US3/AC2, US3/AC3 |
| mixed/track-four-first | mixed/track-four-first: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US3/AC1, US3/AC2, US3/AC3 |
| mixed/track-six-first | mixed/track-six-first: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US3/AC1, US3/AC2, US3/AC3 |
| mixed/headers | mixed/headers: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US3/AC1, US3/AC2, US3/AC3 |
| reject/string-zero | reject/string-zero: 期待拒否と保存不変 | persisted | US1/AC5 |
| reject/string-outside | reject/string-outside: 期待拒否と保存不変 | persisted | US1/AC5 |
| reject/fret-negative | reject/fret-negative: 期待拒否と保存不変 | persisted | US1/AC5 |
| reject/fret-fraction | reject/fret-fraction: 期待拒否と保存不変 | persisted | US1/AC5 |
| reject/fret-outside | reject/fret-outside: 期待拒否と保存不変 | persisted | US1/AC5 |
| reject/kind-conflict | reject/kind-conflict: 期待拒否と保存不変 | persisted | US1/AC5 |
| drum/legacy-numeric-rest | drum/legacy-numeric-rest: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US2/AC1, US2/AC4 |
| mixed/explicit-shared-event | mixed/explicit-shared-event: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US3/AC1, US3/AC2, US3/AC3 |
| reject/rest-with-tie | reject/rest-with-tie: 期待拒否と保存不変 | persisted | US1/AC5 |
| reject/rest-with-head | reject/rest-with-head: 期待拒否と保存不変 | persisted | US1/AC5 |
| reject/invalid-shared-event | reject/invalid-shared-event: 期待拒否と保存不変 | persisted | US1/AC5 |
| mixed/systems | mixed/systems: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US3/AC1, US3/AC2, US3/AC3 |
| mixed/pages | mixed/pages: 記号・位置・リズムの独立条件 | import, roundtrip, persisted, document, svg, visual | US3/AC1, US3/AC2, US3/AC3 |
| tab/invalid-string-input | Known fields and diagnostics are retained | import, roundtrip, persisted | US1/AC1, US1/AC3 |
| tab/conflicting-string-input | Known fields and diagnostics are retained | import, roundtrip, persisted | US1/AC1, US1/AC3 |
| mixed/unknown-normal-pitch | Known fields and diagnostics are retained | import, roundtrip, persisted | US1/AC1, US1/AC3 |

## 対照と回帰

fixture-suite-tests.tsはcount/absent条件の欠落・不要追加、位置の移動、タイの端点変更、譜線の数字貫通をコピーに注入し不合格になることを検証する。tablature-svg.test.tsは実文字の欠落・桁逆順・実座標変更、percussion-svg.test.tsは正しいmetadataに残った誤文字を検証する。coverage.test.tsで条件の欠落と適用段階を検査する。

旧notation suite69件、通常Core/MIDI、音声・練習・採点・null直接変換拒否・元データ不変は全回帰で確認する。DB実行は保留。Bravuraの実形状、重なり、ブラウザーのフォント解決は目視未実施である。


## Phase 7 Convergence coverage

| 条件 | fixture / test | 検証 |
| --- | --- | --- |
| 括弧付きドラム符頭の省略警告・元属性 | drum/ghost-parentheses / musicxml-convergence.test.ts | 基本符頭のDocument/SVG、JSON往復、診断と演奏不可。persisted/visualは未実施 |
| 未対応7弦の譜表属性保持 | tab/unsupported-strings / musicxml-convergence.test.ts | 元staff-lines=7・所属箇所・昇格抑止・64KiB上限。persisted未実施 |
| 同音異運指・同時弦・同時打音・声部 | tab/same-pitch-different-fingering, tab/simultaneous-strings, drum/simultaneous, drum/voices | 各音のpitch/start/duration/voice/表記と各Document/SVGの数字・弦・符頭・位置。各音だけの削除・誤数字・誤弦・誤符頭・誤位置で失敗 |
| 調弦矛盾の入力別扱い | tab/tuning-conflict, reject/tuning-conflict | MusicXMLはpartialと元調弦・診断、JSONは保存拒否期待値。実DB未実施 |
| MIDI楽器／チャンネル端点・範囲外 | musicxml-convergence.test.ts | 1/128→0/127、1/16→0/15と0/129・0/17のpartial診断・元instrument保持 |

新規3件を加え、009は112 fixtures。原要件の対応表を維持し、上記はT064/T065/T066/T069に対応する。DB用テストは診断の一致も検証するが実行合格を意味しない。


## Phase 8: 未対応ドラム奏法の保持

| 条件 / 要件 | fixture / test | 適用段階と期待値 |
| --- | --- | --- |
| ロールの元指定 / FR-009, SC-006 | drum/omitted-roll | 基本符頭はrender。tremolo値と省略警告・演奏不可をimport、JSON/Sheet往復、Document/SVGで確認。persisted/visualはpending |
| ハイハットの未対応奏法 / FR-009, SC-006 | drum/omitted-open-hihat | 原入力の×符頭と位置を維持。other-articulationの元文字列・診断を保持。persisted/visualはpending |
| 装飾音の未確定時刻 / FR-009, SC-006 | drum/omitted-grace | duration=nullのpartial。grace属性をJSON往復・保存取得用期待値に保持。描画は非適用、persistedはpending |
| technical外の指定・既存ブラシ指定 / T071 | musicxml-convergence.test.ts | ロール・ハイハット・ブラシのJSON/Sheet往復、装飾音のpartial往復と昇格抑止 |

現在009は115 fixtures。T073のBrave概略確認はvalidation.mdへ記録し、全visualChecklistの合格とは区別する。DB保留・個別目視未確認を含む最終監査はT072–T074へ引き継ぐ。


## コードレビュー修正（2026-10-21 JST）

| 条件 | fixture | 検証 |
| --- | --- | --- |
| 共有イベントの配列順とタイ / FR-010, FR-017, SC-005 | mixed/shared-tie-reordered | 4つの表示ノート、練習1打鍵・保持時間1秒、継続元、Document/SVGの2本のタイ接続先を検証。単体テストで入力順の複数パターンと音声代表IDも確認 |
| 打楽器から通常譜への復帰 / FR-001, FR-007, FR-010 | drum/percussion-to-standard | 後続音高60・standard設定とG音部記号、JSON/Sheet往復・保存取得用期待値 |
| TABから通常譜への復帰 / FR-001, FR-003, FR-010 | tab/tab-to-standard | 6→5線、後続音高60・standard設定、G音部記号と調号2♯の表示 |
| 別譜表の音部記号の保持 / FR-001, FR-011 | mixed/independent-clef-change | 通常譜だけG→F、TABはsign=TAB/line=5を保持。変更音部記号をDocument/SVGで独立確認 |

119 fixturesに増加。各正常条件は全6段階を要求するが、persisted/visualの未実施を合格にしない。小節間変更には前後2小節が必要であることをsizeReasonに記録した。
