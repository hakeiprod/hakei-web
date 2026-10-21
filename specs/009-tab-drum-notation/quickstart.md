# Validation Guide: TAB・ドラム

この手順は実装後に実行する。計画段階では新テスト・suiteは未作成。

## 前提

Node22、既存依存、Prisma生成済み、同梱Bravura。DBテストは末尾_testの専用PostgreSQLだけを使う。利用者指示により今回のDB実行は保留し、既存DATABASE_URLへ接続しない。008の未実施証跡は解消済みとしない。

## 自動確認

1. tasksで作成するnullable音高・譜表設定・TAB／percussionの境界テスト、importの4版とMXL、promotionと再検証、capabilities、geometry、数字列／符頭／アンカーの単体テストを実行する。
2. `node --import tsx scripts/verify-notation-fixtures.ts --suite tab-drum` を実行。009のverification-results.jsonに自動段階のみ記録され、persisted/visualはpendingとなることを確認する。
3. `node --import tsx scripts/verify-notation-fixtures.ts --suite notation` を実行。008の結果と保存先が独立し、既存条件が合格することを確認する。
4. `npm test -- --run`、`npx tsc --noEmit`、変更TS/TSXの`npx eslint <paths>`、`npm run build`を実行。worker生成も含める。SMTPなど既存環境による失敗は理由と条件付き検証を記録し、通常build成功と混同しない。

DB環境が将来整った段階で `npm run test:integration -- src/server/score-tab-drum.integration.test.ts src/server/score-import.integration.test.ts` と `node --import tsx scripts/verify-notation-fixtures.ts --suite tab-drum --persisted` を実行する。convert→署名→保存→取得→同じ表記／描画期待値、提案・マージ・再取得、旧資料、認可・改ざん・矛盾入力の原子的拒否を確認する。

## 実ブラウザー

`npm run dev`後に/dev/notation/fixturesでsuiteを区別して開く。TAB各弦とフレット0/9/10/36、数字の譜線抜き、複数弦とリズム、上下タイ・全ページを確認。ドラム9楽器・通常／×符頭と複数声部、混在での線数・高さ・拍位置を確認する。debug、再配置、背景色変更でも数字が判読できることを確認。

実際の取り込み画面と保存後の表示も確認し、ドラムや音高不明TABで表示はできても再生・練習・ゲームが不可と理由付きで示されること、直接の音声・timeline入口も拒否することを確認する。既存通常譜の再生は維持する。

## 完了判定

[fixtures契約](contracts/fixtures.md)に従い、確認範囲・結果・ブラウザー・確認者と版をvisual-results.jsonに記録。coverage.mdへFR-001–017／SC-001–006／全12受け入れ条件とfixture/assertionを対応付ける。validation.mdに実行結果、同一環境での性能・再layout比較、保留したDBと目視の項目を記載する。未実施・古い結果を合格にしない。


## 承認済み境界条件の確認

完全候補の通常音高null拒否と、不完全候補の通常音高null保持を別々に確認する。打楽器譜の休符はrest:true/pitch:null、打音用表記なしで各5音価の保存・再取得・描画を確認し、旧数値付き休符も読み続けることを確認する。休符へ符頭・楽器・タイ・発音を付加しない。

記譜契約の入力条件表に従いrender/partial/rejectをそれぞれ確認し、partialは既知値・元の未対応情報・診断の往復と実保存保持を検証する。

T056の版更新とその後のコード修正を終えてから、最終ソース版で008/009両suiteの自動検証を実行する。そのfingerprintで失効した目視条件を両suiteとも再確認し、現在版のvisual-results.jsonを記録した後で最終監査する。環境不足なら未実施のまま残す。
