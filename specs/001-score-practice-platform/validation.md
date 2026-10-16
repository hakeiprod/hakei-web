# Implementation validation

## Baseline

Before implementation: Vitest 18 files / 278 tests passed.
ESLint: no errors, two existing unused-import warnings.
Typecheck: existing errors in MusicXML key signatures, SoundFont sample types, MIDI key signatures and XSD schema generation.
Next build fails on the existing MusicXML key-signature type error.
Runtime for subsequent validation: Node.js 22.16.0 (temporary musl build).
Dedicated local PostgreSQL database: hakei_test on loopback port 55432. Production database is not used.

## Implementation foundation (2026-10-13)

- Prisma schema validation/client generation: passed.
- Four migrations including score_git_foundation applied to dedicated local hakei_test only.
- PostgreSQL two independent connection test: passed.
- Full unit/component suite after initial Git/auth changes: 283 passed.
- Existing baseline type errors remain; new Git adapter typing issues found by tsc were corrected.
- OAuth end-to-end login still requires operator-supplied development credentials.

## Earlier checkpoint stop: T012 (resolved)

Final full Vitest run: 288 passed, 1 failed (23 files).
Dedicated PostgreSQL/Git integration run: 7 passed (4 files).
Changed source ESLint: passed. Typecheck retains baseline failures; no errors in new server/import/script files.
No implementation extension hook file exists.

Failed sequential task T012: the standard Sheet JSON schema requires tracks[0].duration,
but an existing multi-bar Core.Score.create(...).toSheet().export() omits this value at
the JSON transport boundary. The regression test remains failing to preserve the evidence.
Investigate Track event export and specify the authoritative duration representation before
relaxing the schema; do not fabricate missing musical values.

The implement skill requires stopping on a failed sequential task. T012 and downstream
story tasks remain incomplete. T009, T011 and T013–T018 contain partial implementation/test
work but remain unchecked pending their full acceptance scenarios. T001–T008 and T010 are
checked at that checkpoint (9/82). No production migrations, push, deployment or data assignment were performed.

Next action: correct T012 compatibility and verify its regression, then finish the remaining
foundation acceptance scenarios before proceeding to US1/US2/US6/US3/US4/US5.

## Resumed implementation

T012 resolved: Track imports no longer pass serialized numbers to Event; track duration derives
from notes. Historical missing derived duration remains accepted. Note IDs are scoped by track;
stave instances are scoped by track/bar. Real single- and multi-bar/track exports are covered.

US1/US2 foundation and implementation: T001–T037 complete (37/82).

- Latest full unit/component run before the added UI scenarios: 296 passed.
- Latest full real PostgreSQL/Git integration run: 23 passed; decision/archive scenarios add 2 passed.
- UI tests verify retained edits/operation keys, operator confirmation, identity-change cleanup,
  and rejection of client-supplied actor claims.
- New server/app/component source has no new TypeScript errors. Baseline SoundFont/XSD/legacy rhythm
  type errors still require resolution before the final build check.
- No production migration, deployment or push was performed.

Beginning US6 import conversion. MIDI binary parsing is delegated to midi-file 1.2.4;
its adapter validates the accepted grammar and byte lengths. Running status, long metadata,
unsupported variants, channel pairing and fractional tempo have explicit fixtures.

## US6 import checkpoint

T038–T053 implemented and acceptance scenarios verified (53/82 total).

- Full unit/component checkpoint: 364 passed; added initial-metadata/no-attacks checks
  required distinguishing viewable rest-only sheets from playable sheets. All 17 legacy
  MusicXML importer cases pass after that distinction.
- Full PostgreSQL/Git integration checkpoint: 35 passed, including real worker deadlines,
  pooled admission, warning acknowledgement, expiry, permission revocation, proposal/merge
  inheritance, and corrected-new-revision-only eligibility.
- Import lint: no errors or warnings after cleanup; TypeScript check passed after the final
  projection timestamp signature correction.
- Source files remain in browser/request/worker memory only; Git stores selected converted
  score/settings/diagnostics/validation. No production migration, push or deployment occurred.
- Begins US3 with seven pure timeline/matching tests covering boundaries and determinism.

## US3 checkpoint — 2026-10-14

T054–T064完了、64/82タスク。Node.js 22.16.0、専用PostgreSQL（localhost:55432/hakei_test）。
全単体テスト53ファイル383件、全DB統合テスト15ファイル39件、`tsc --noEmit`と練習機能変更箇所lintが成功。
共有タイムラインの予約時刻、タイの再打鍵除外、選択機器・FIFO離鍵・背景化・購読と音声cleanupを代替ブラウザーAPIで検証。
同じ入力を3つの記録で再評価して一致。再送は1記録だけ保持し、条件やイベントの変更は競合。
未解決楽譜の開始と保存、未知の版、権限喪失後の録音開始・保存を拒否。クライアント採点は受け入れない。
未離鍵の完了は拒否、中断は正式スコアなし。保存失敗時は入力とclientSessionIdを保持し、再試行まで次の演奏で上書きできない。
実MIDI機器・実ブラウザーと初見利用者検証はT079で未実施。履歴・ゲーム・本番buildは後続タスク。

## US4 checkpoint — 2026-10-14

T065–T070完了、70/82タスク。Prisma生成の`20261014032521_practice_achievements`を専用DBだけに適用。
本人履歴・個別結果・削除確認の画面を追加。本人認証境界でログアウト/別ユーザー時に履歴をunmountし、クライアントの永続キャッシュは作らない。
楽譜の現在の権限と本人の分析要約を分離し、閲覧権限喪失後も要約は読めるが本文はnullになることをDBで確認。
完了回数、条件別ベスト（正確率→数値時刻ずれ→同率先着）、中断除外、条件変更時の別グループ、null、削除後再計算、再送キーの一致/競合を検証。
練習/履歴DB統合6件、練習/履歴画面4件、型チェック、履歴変更箇所lintが成功。
Achievementは保存/削除と同じSerializable transactionで残る完了記録から再構築し、最初の完了とベスト更新を重複計上しない。

## US5 checkpoint — 2026-10-14

T071–T076完了、76/82タスク。ゲーム/練習/履歴の単体22件、DB統合12件、型チェック、ゲーム変更箇所lintが成功。
±30ms/60msの両端と1µs越え、和音worst判定、欠落/余分音、余分音の最寄り和音・同差先着、時系列コンボ、0/100点と同一入力3回を検証。
画面は同じMIDIセッションで100msごとの暫定判定と、サーバー再評価の確定値を表示。中断は正式スコアなし。
GAMEの版付き採点、再送重複防止、履歴/ベスト/達成、中断除外、BLOCKING版の開始・保存拒否を実DBで確認。
normal seedは不変のEvaluationRuleVersion 1だけをupsertし、既存版の値は変更しない。ランダム音楽デモは明示的な`--demo`時のみ。信頼度の運営設定は別で自動有効化しない。
Next.jsの自動設定と整合するmoduleResolution=bundlerへ移行。既存JSON宣言をTypeScriptの`.d.json.ts`形式に改名し、allowArbitraryExtensionsで利用する。binary-parserは同梱された宣言を明示し、古い別パッケージ型との食い違いを回避した。

## Final automated checkpoint — 2026-10-14

81/82タスク完了。T079（実MIDI/実ブラウザー・初見5人の試用確認）は未実施のまま残す。

- Node.js 22.16.0。専用PostgreSQL 18 `hakei_test`のみを使用し、本番DBへの移行・復元は行っていない。
- 全単体: 59ファイル399件成功（`npm test -- --run`）。全DB統合: 18ファイル45件成功（`npm run test:integration`）。
- `npx tsc --noEmit`成功。最終`npm run build`内の型検証とTurbopack本番ビルドも成功。
- 型宣言/生成物を除く変更ソース206ファイルのeslint成功、`git diff --check`成功。
- Dev Container JSONとCIのPostgreSQLクライアント生成スクリプトの構文確認成功。
  CIには専用PostgreSQL 16、同じmajorのdump/restore client、生成/移行/seed/単体/DB統合/型/buildを設定。
  このセッションではGitHub Actionsのリモート実行・pushはしていない。
- 正の補正分だけ末尾の記録待機を延ばし、補正後の末尾打鍵を落とさない回帰テストを追加。
- キーボード操作に使うbutton/select/input/details・関連ラベル・table caption・状態メッセージをコードとaccessible-nameテストで確認。
  判定は色だけに依存せず、早い/遅い、音高、失敗、中断/未評価を文章で表示。
  失敗時の同内容再試行、新しい演奏による未保存記録の上書き禁止、beforeunloadの保護、pagehide/BFcacheとlogoutのcleanupを検証。
  認証エラーは引数をログへ出さず、Action/HTTPは秘密や入力本文を含まない公開エラーを返す。

### T078: 4CPUで30回の計測

CPU affinityを4に制限（availableParallelism=4、ホスト20論理CPU）、メモリー7,888MiB、ローカルPostgreSQL。
各1回warm-up後に30回計測。プロセス高水位RSS 271.93MiB（PG/子workerを含むシステム全体の最大値ではない）。

| 対象         | 規模                     |      p95 |     最大 |
| ------------ | ------------------------ | -------: | -------: |
| 分析         | 10,000期待音・50,000入力 | 210.17ms | 219.66ms |
| 本人履歴     | 保存50件・1ページ50件    |  61.43ms |  63.54ms |
| MusicXML変換 | partwise 678bytes・1音   |   6.25ms |  16.41ms |

分析2秒・一覧500msの暫定目標を達成。5MiBを1byte超える原本を拒否することも確認。
変換の小さいサンプルは最大入力での処理速度を保証しない。展開量/entry数/音符数/時間制限は単体/worker統合試験で別に検証。
再現コマンド・制限はdocs/development.mdとscripts/benchmark-score-practice.tsを参照。

### T081: checkpointと復元

全アプリAction、取り込みRoute、Auth.js adapter書き込み、運営付与・移行・回復CLIを同じPOSIX保存領域のadmission leaseへ接続。
原子的なgate作成と二重チェックで新規書き込みを止め、既存leaseが空になるまで待機する。
採用版・提案・練習の参照版・準備receipt/job・DB記録前の準備refを保持し、排他下でGC後も存在することを確認。
DB dumpとbare GitコピーのmanifestにcheckpointId、object format、採用OID/世代、refs/保護OID、版の本文ハッシュ、dump/全GitファイルのSHA-256を記録。
新しい専用`_test` DBへ実dumpを復元し、Gitとの全索引照合・回復入口・改ざん検出を検証。復元DBと一時バックアップは試験後に削除。
検証失敗/進行中writerタイムアウトはgateを維持し、stale leaseを自動削除しない。外部SQL/Prisma migrationは運営が停止する前提を文書化。

### T082: 運用文書

README・development・quickstartに運営の初回付与、秘密設定、信頼度の明示的な数値有効化、移行・対応形式/上限・原本再アップロード、
不変ルールseed、MIDIと履歴、バックアップ/隔離復元とgate失敗時の手順を記載。
Dev ContainerにPostgreSQL clientを追加。T079の実機/非対応環境/5人試用の確認項目を残した。
変更は未コミット。自動検証は完了しているが、実機と利用者の確認が終わるまで全タスク完了とは扱わない。

## T079 実施準備

ユーザー回答: 初見の協力者5人は確保できていない。
実機操作・実ブラウザー観測・初見5人の試用結果は未取得で、T079は未完了を維持する。
[実施手順と記録表](t079-manual-validation.md)を作成した。現在は準備までであり、実機・利用者の検証成功とは扱わない。
