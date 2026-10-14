# Research: score-practice-platform

調査日: 2026-10-13。既存ソースと公式資料を確認し、設計上の未知点を以下で解決した。
製品の確定SLOを推測せず、計測用の暫定条件と運用入力を分ける。

## 1. 実行環境と既存実装

**Decision**: Next.js 16、React 19、Prisma 6の既存構成を維持。検証環境をCIと同じNode.js 22に統一する。
**Rationale**: package.jsonとCIに既存のVitest/jsdom構成がある。Dev ContainerのみNode.js 20。
**Alternatives considered**: 別APIサーバー、新しい認証基盤、描画基盤の置換は不要。

既存Scoreはid/dataのみ。create/deleteアクションとhome一覧には認可がない。
`src/auth.ts`はPrismaAdapterを設定済みだがprovidersは空。
MIDI connecterは全機器を接続してKeyboardへ通知し、選択機器・チャンネル・時刻を記録していない。

## 2. 認証・認可

**Decision**: 既存Auth.jsとPrismaAdapterを再利用し、初期実装はGitHub OAuthとDBセッション。
認証プロバイダーの差し替えは設定単位で可能とし、製品仕様にGitHubを必須化しない。
運営ロールはDB上の明示的権限。初回運営は管理されたセットアップ処理で既存ユーザーIDに付与する。
クライアント入力やメールだけからロールを付与しない。
**Rationale**: 全Server ActionとDB読取に認可が必要。layoutのログイン判定だけでは保護にならない。
**Alternatives considered**: middlewareだけの保護、クライアントのcanMergeだけの判定は拒否。
**Sources**: [Next.js Authentication](https://nextjs.org/docs/app/guides/authentication),
[Auth.js Prisma Adapter](https://authjs.dev/getting-started/adapters/prisma),
[Auth.js GitHub provider](https://authjs.dev/getting-started/providers/github)。

## 3. 原本・履歴・競合（Gitへ設計変更）

**Decision**: サービス内リポジトリごとにbare Gitで楽譜JSON・設定・診断のコミットを管理する。
Git CLIを公開された引数APIとして利用し、アプリのGitと保存領域を分離する。
ScoreRevisionはDB上の本文コピーからコミット索引へ変更し、提案はbranch/refとして保持する。
採用先端はDBで確定し、Git mainは復旧可能な投影とする。
**Rationale**: Gitの内容アドレスと履歴を再利用し、DBの信頼度/権限・実績と採用確定を原子的にできる。
**Alternatives considered**: DBのみの版管理、Gitを先にmainへ反映する二重書込、Git/DBの擬似単一transactionは不採用。
GitとDBの境界・復旧・GC・バックアップは[Git版管理契約](contracts/git-versioning.md)で定義する。
**Sources**: [Git commit-tree](https://git-scm.com/docs/git-commit-tree)、[Git update-ref](https://git-scm.com/docs/git-update-ref)。

## 4. 信頼度の決定的な算出

**Decision**: 設定は有限の宣言的数値パラメーターで表す。式のコード実行やevalはしない。
ルール版にはinitialScore、運営調整/実績/他者評価の3重み、採用/却下の加減点、
評価値の上下限と係数、最終スコアの上下限、mergeThresholdを含める。
S = clamp(initialScore + wAdmin*A + wOutcome*(acceptedDelta*M + rejectedDelta*R)

- wReview*reviewFactor*E, minScore, maxScore)。
  Aは運営調整の合計、M/Rは有効な他者による採用/却下件数、Eは有効な他者評価の合計。
  運営が直接値を指定する場合、目標値targetが[minScore,maxScore]内であることを検証する。
  B=initialScore+wOutcome*(acceptedDelta*M+rejectedDelta*R)+wReview*reviewFactor\*E として、
  A_new=(target-B)/wAdmin、台帳へ記録する差分はA_new-A_currentとする。
  現在表示されるclamp済みスコアとの差だけで調整しない。計算は同じルール版・実績・評価のスナップショットで行う。
  重みが1以外、上限/下限に達している状態、同時の設定変更でも目標値と結果の一致を検証する。
  wAdminは正、その他重みは非負、全値は有限、minScore <= initialScore/mergeThreshold <= maxScore。
  固定の本番値は置かず、運営が設定して有効化する。
  **Rationale**: 重みと加減点を変えられ、版ごとの再現が可能。単純な監査可能な算出から始める。
  **Alternatives considered**: リポジトリ別のスコア、投票による自動採用、任意スクリプト式は仕様と不一致。

**Decision**: 1評価者/対象ユーザーに1件の最新評価を持ち、変更履歴は残す。自己評価は禁止。
提案者=マージ実行者の採用はMに含めない。運営調整にも理由を必須とする。
**Rationale**: 同一評価の繰り返しで信頼度を無制限に増やさず、既存の自己加点禁止を守る。
**Alternatives considered**: 全評価を無条件に加算すると再送・反復操作で加点できる。
これらは設計上の初版既定であり、多重アカウントの完全な排除は保証しない。

## 5. MIDI・音声の時刻

**Decision**: ユーザー操作でsysexなしのMIDIアクセスを要求し、選択した入力のイベント時刻を記録する。
機器IDはセッション内の識別に使い、長期識別や物理機器認証の根拠にしない。
MIDIMessageEvent.timeStampを使用し、AudioContext.getOutputTimestamp()が利用可能なら
音声出力時刻とperformance時計を対応付ける。未対応時は同時サンプルの時計対応と補正値を使う。
Permissions Policyでmidiを許可し、音声とMIDIの起動は明示的なユーザー操作に結び付ける。
音声再開後の単調時刻を原点にし、入力遅延は正の値を入力時刻から差し引く。
**Rationale**: 描画フレームやコールバック処理開始時刻で採点しない。
**Alternatives considered**: Date.nowによる採点、全機器混在、MIDI SysEx要求は不要。
**Sources**: [W3C Web MIDI API](https://www.w3.org/TR/webmidi/),
[MDN requestMIDIAccess](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/requestMIDIAccess),
[W3C Web Audio API](https://www.w3.org/TR/webaudio-1.0/)。

## 6. 音楽タイムラインと評価

**Decision**: 標準保存JSONを検証して複製し、既存Sheet/Coreモデルとdocument/audio変換を再利用。
期待音の生成は休符を除き、タイを新しい打鍵として数えず、選択トラックに限定。
テンポ区間を積分して時刻を求め、選択テンポによる比率と対象範囲の原点を適用する。
既存再生の絶対拍にその位置のテンポを単純適用する経路は新タイムラインへ適合させる。
**Rationale**: 途中のテンポ変更やタイを含む楽譜を表示・練習・採点で一致させる。
**Alternatives considered**: 音符配列をそのまま採点、各音の絶対拍を現在テンポで変換すると境界で不一致。

**Decision**: マッチングと和音判定は[contracts/midi-evaluation.md](contracts/midi-evaluation.md)で固定。
終了後のサーバー再評価を保存の正とし、ライブ評価は暫定表示。時刻順・安定IDで順序を固定する。
**Rationale**: 同じ記録で3回同じ結果という成功基準を守る。クライアント申告スコアを信じない。
**Alternatives considered**: ライブ表示値をそのまま保存すると再送・実行順で差が出る。

## 7. 互換性・削除・性能

**Decision**: 移行は追加カラム/テーブル、既存JSONのGit初版と索引、運営による所有者確認の順。
所有者不明のScoreは未管理として隔離し、初版JSONを保持。公開範囲や所有者を推測しない。
個人結果削除は入力・結果を削除し、完了回数/自己ベストを残る記録から再算出。
楽譜は論理アーカイブし、参照される版を消さない。アクセスを失った利用者には楽譜内容を再公開せず、
本人の演奏結果要約は保ち、楽譜内容の再閲覧には現在の権限を要求する。
**Rationale**: 履歴を新しい版で再採点せず、削除と達成表示の整合を維持する。
**Alternatives considered**: 既存行の一括破棄、推定所有者、記録ごとの無制限JSONコピーは拒否。

暫定測定環境・上限はplan.mdに記載。大規模分散基盤を先に追加せず、索引と時間窓内の照合を利用する。
性能、OAuth資格情報、本番の数値設定は運用検証事項として具体化済みで、設計の未解決マーカーはない。

## 8. 楽譜形式の追加調査

**Decision**: 初版はMusicXML 4.0 score-partwise（XML/MXL）、SMF 1.0 format 0/1のPPQN、
既存CoreパラメーターJSONとSheet export JSONを明示的に認定する。
MusicXML score-timewise/opus、他バージョン、SMF format 2/SMPTE、MIDI 2.0、PDF/画像は理由付き未対応。
**Rationale**: 既存MusicXMLの4.0型と変換器、MIDIの拍ベースモデルを再利用し、対応を検証できる。
**Alternatives considered**: 未検証の全バージョン対応、画像認識、未知形式の推測変換は初版に含めない。
**Sources**: [W3C MusicXML structure](https://www.w3.org/2021/06/musicxml40/tutorial/structure-of-musicxml-files/),
[W3C MXL container](https://www.w3.org/2021/06/musicxml40/container-reference/elements/container/),
[MIDI Association SMF specification](https://midi.org/standard-midi-files-specification)。

**Decision**: MIMEだけで形式を判定せず、拡張子・シグネチャ・ルート/ヘッダーを照合する。
既存MIDIのチャンネル別打鍵/離鍵、running status、メタイベント長、拍子分母、
全トラックのメタイベント統合を回帰テストで修正する。
**Rationale**: 既存Importerはaudio/midだけでMIDIを選択し、raw XMLの入口がない。
MIDI変換は音高だけで最後の音を閉じ、parserの拍子分母はitem ** 2となっている。
仕様どおり2 ** itemへ訂正し、テンポと拍子・調号を絶対tick上で正規化する。
**Alternatives considered**: 既存パーサーの未検証出力をそのまま認定することはしない。

**Decision**: 警告をINFO/WARNING/BLOCKINGに分類し、構造不正をFATALとして変換を拒否。
認識できない音高・時刻・テンポなどはBLOCKING。歌詞・印刷レイアウトなど採点に影響しない欠落はWARNING。
整列は四分音符=1拍のグリッド上でonsetとdurationをそれぞれ最近傍へ丸め、同距離は早い/短い側。
非正の長さになった場合は1グリッドに補正して警告する。既定はPRESERVE。
**Rationale**: 保存を許可しつつ採点の正しさを守り、元データからの再プレビューで丸め誤差の累積を防ぐ。
**Alternatives considered**: 警告確認で採点を自動解禁、整列を強制、丸めた結果からの再整列は拒否。

**Decision**: 元Fileは変換中だけ保持。プレビューRoute Handlerはstatelessなメモリ内変換で、
保存時は署名された候補・警告と変換設定を検証して永続化する。元ファイルは保存しない。
**Rationale**: 保存後の再変換が不要という回答を守り、一時データの削除漏れを減らす。
**Alternatives considered**: 原本をDB/ストレージへ保存、非同期ジョブのpayload永続化は仕様に反する。
移植可能な変換器だけをs-coreへ置き、File/HTTP/署名処理はブラウザー/サーバーへ分ける。

**Decision**: MusicXMLのdivisions/duration、backup/forward、和音のカーソル、声部・譜表、
タイ・連符を音楽上の時刻として扱う。異なるパートのメタ情報を先頭パートだけから推測しない。
Core.Score.createは渡された値を変更するため、入力と各プレビューには独立した複製を使う。
**Rationale**: 元のプレビューへ戻ったときに変換途中の補完・整列が混ざることを防ぐ。
**Alternatives considered**: 同じ入力オブジェクトへの反復変換や、未対応な演奏情報の黙った除外は拒否。
**Sources**: [W3C duration](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/duration/),
[W3C note](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/note/)。

## 9. 標準機能・ライブラリを優先する実装方針

**Decision**: 認証UIは既存next-authのsignIn/signOut/authと組み込みログイン・エラー画面を利用する。
ヘッダーに操作の入口を置き、独自のOAuth、セッションCookie、CSRF、パスワード認証は実装しない。
**Rationale**: 既存依存の責務を再利用し、利用者がログイン・ログアウトを完了できるタスクを明示する。
**Alternatives considered**: 独自認証フォーム/プロトコルは不要。
**Source**: [Auth.js Next.js reference](https://authjs.dev/reference/nextjs)。

**Decision**: 入力検証はZod、DB整合性はPrisma/PostgreSQL、署名はNode.js標準cryptoの
createHmac(SHA-256)/timingSafeEqualを用いる。署名するのは固定順序で構築したトークンpayload。
候補・診断・設定は安定したキー順で正規化してハッシュし、期限・主体・用途も検証する。
標準機能と既存ライブラリで不足するときだけ、公式資料と保守状況を確認して新規依存を追加する。
推移依存を直接importせず、必要な新規ライブラリはpackage.json/lockfileに直接依存として記載する。
**Rationale**: 暗号アルゴリズムやバリデーション基盤を自作しない。
**Alternatives considered**: 独自署名方式、Auth.jsの内部トークン実装の流用は不要。
**Source**: [Node.js Crypto](https://nodejs.org/docs/latest-v22.x/api/crypto.html)。

楽譜変換・信頼度算出・採点は本サービス固有の規則であり、既存ライブラリを境界に使いながら純粋関数で実装する。

Gitの採用は自動JSONマージではなく、基準repo先端の一致と検証済みtreeによる明示的操作。
初版は異なる楽譜の先行変更でも古いrepo基準を競合として拒否する。
信頼度入力の版と操作receiptのDB保存を具体化し、採用/実績の再計上を防ぐ。
Git保存には永続ディスクと回復workerを必要とし、完全なstateless配置は初版では対象外。

## 実装時のMIDI解析選択（2026-10-13）

SMFのデコードはmidi-file 1.2.4の公開parseMidi APIへ委譲する。
既存のbinary-parserによる自前分岐は、トラック間running status共有、可変長meta、
イベント種別の未処理などの欠陥があるため置換する。midi-fileはMIT・実行時依存なし、
型定義あり。配列/Uint8Arrayを受け取りDOM/Node専用APIに依存しない。
既知不正なチャンク/イベント長と許可形式は境界アダプターで検証し、
音符対応・診断・整列は本サービスの純粋規則に分ける。
Node22/Vitestの既知バイトfixtureでrunning status、長meta、拍子と不正入力を検証する。
プロジェクトnpm auditには既存の警告があるため、全体の安全性を保証するとはしない。

公式: https://github.com/carter-thaxton/midi-file
SMF仕様: https://midi.org/standard-midi-files-specification

### Implementation dependency verification (2026-10-13)

Next.js / eslint-config-next are pinned to 16.4.0, next-auth to 5.0.0-beta.32,
and @auth/prisma-adapter to 2.11.3 (@auth/core 0.41.3). These satisfy Node 22,
React 19 and Next 16 peer requirements. The production audit no longer flags these
four authentication/framework packages and has zero critical advisories; ten
other inherited production advisories remain for the final dependency review.

The MIDI codec uses midi-file 1.2.4 (MIT) through its public parseMidi API, with
strict accepted-grammar and length checks in the service adapter. MusicXML parsing
uses the existing xml2js public API without external retrieval; MXL extraction
uses existing JSZip public nodeStream, counts actual expanded bytes for all entries,
and validates unsafeOriginalName as well as container paths.

The conversion worker is a Node worker_threads worker with a time limit, isolated
heap budget, in-memory structured-clone input and explicit termination in finally.
A shared PostgreSQL admission lease enforces one conversion per actor across
instances; expired leases can be reclaimed and old owners cannot release replacements.
The build uses esbuild 0.28.2 (MIT, Node >=18) as an explicit development dependency.
Its public build API bundles the worker and its dependencies into dist/import-worker.mjs
for Node 22; production does not require a TypeScript loader or source files.
Build/dev/integration commands construct this artifact before execution.
Official references: https://esbuild.github.io/api/#build and
https://nodejs.org/api/worker_threads.html#workerresourcelimits .

MXL extraction uses JSZip's documented `ZipObject.internalStream('uint8array')`
and StreamHelper on/resume/pause API, not Node-specific streams. This keeps the
byte converter usable by the browser adapter and the server worker alike.
Its bundled typings omit that public method, so the adapter supplies its API type;
entry paths, central-directory counts, actual expanded bytes and XML roots are
validated separately. Optional rootfile media-type is checked against actual XML.
Reference: https://stuk.github.io/jszip/documentation/api_zipobject/internal_stream.html .

MusicXML uses an explicit ordered-element adapter because the legacy converter
fills missing pitch/divisions silently and cannot represent nullable partial notes.
The adapter retains known notation separately from missing music fields, handles
backup/forward/chord timing, and emits diagnostics instead of inventing those fields.
Existing Sheet/engraving/audio models remain the rendering path for complete exports;
legacy fixtures, beam/stem geometry, explicit note types, dots and ties are covered.
