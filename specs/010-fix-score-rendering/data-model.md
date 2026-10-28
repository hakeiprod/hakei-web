# Data Model: 描画ジョブと派生レイアウト

永続schema・Sheet/partialの保存形式・metadata/diagnosticsは変更しない。

## Source snapshot

- 入力: 既存検証済みSheetのserialized data、楽譜/改訂の識別または入力世代。
- データ境界で既存schemaを利用。render中の同期parse/importを繰り返さず、検証済みsnapshotをジョブに渡す。
- 007の5,540音ハッシュ、設定・構成・診断を保持。描画用のrows/slots/geometryは元候補へ書き戻さない。

## RenderOptions

layoutType、scale、viewportWidth/Height、pageLayout、advanced、debug、font identity。有限・正の値、既存layout enumとpage範囲を検証する。pageIndexは完了したページ数へclamp。scale/viewportは値スナップショットとして凍結し、処理中に参照元が変化しても混ぜない。

## LayoutIndex（メモリー内）

所有者は一つの私有Score。生成中の全関連が揃ってから利用開始する。

| 関連 | キー | 保持する規則 |
| --- | --- | --- |
| notes / chord | chord ID | 既存の音符配列順 |
| chord / slot | beat value・chord ID | Beat.equalと同じ比較、和音順 |
| stave / bar | trackId + barId + staveId | 同じstaff IDの別パートを混同しない |
| bars / masterbar | masterbar ID | 原配列順 |
| notes/chords/slots / interval | masterbar区間 | 既存isOverlapped、ゼロ長と境界を保持 |
| beams / stave・chord | trackId/barId/staveId、chord ID | 同一和音が持つ複数連桁レベルを保持 |

単一IDが一意とされる関係は重複を拒否し、元契約が複数を許す関係は配列を保持する。float値を丸めたキーで別の開始位置を統合しない。データ変更は新Scoreへ渡す。既存同期APIで変更を扱う際は明示的な再構築を行い、古い索引で返さない。

## LayoutPass

generation、options snapshot、準備済みglyph、natural width、行頭/clef依存の測定、space適用後の幅、前からの累積座標を持つ。reset→prepare→row assignment→measure→space→position→snapshotの依存順を保つ。row割当でheaderが変わる場合は該当測定を無効化。spacingとallocatedWidthを初期化せず再利用することを禁止。ジョブ間の共有キャッシュは持たない。

## RenderJob

- generation: Viewer内の単調増加ID。楽譜/改訂/条件変更、再試行で更新。
- signal: 所有AbortControllerのsignal。
- stage: validate / build / notation / glyphs / layout / document / svg / highlights / publish。
- owned: 私有Score、index/pass、controller、Document、detached SVG、仮のhighlight binding、解放処理。
- publication: 開始時の世代と入力・optionsが最新の場合のみ成功を公開する。

モデルは進行ステップを返すがDOMや時刻に依存しない。ブラウザーadapterが実タスクyieldと取消確認を担当。各大きなループの内側を単位にし、一つのステップ内に数秒の同期計算を隠さない。

## Viewer状態

`idle → loading → ready | error | cancelled`。loading中の条件変更は旧generationをabortし、新loadingへ移行。unmountはabort後にowned参照と購読を破棄。errorは同じsnapshotでretry可能。cancelledの遅い完了は公開しない。

同一楽譜の更新中は前のcommitted表示を更新中として残せる。別楽譜では旧表示を隠す。古い表示に新しい音声highlightを結び付けない。新しい表示が公開されるまで再生の開始を待機させ、音楽的な利用可否と画面のready状態を別に管理する。音源取得・再生ノード等の既存のcleanup責任は維持する。

## Drawing snapshot / performance record

Documentのpages/elements/source/coordinatesを保持し、既存toSVGのglyph/curve/group順序とメタデータを保つ。非同期SVG生成も同じ描画関数と順序を共用する。

性能記録はinput/font/source hashes、環境、条件、cold/warm、stage開始終了、表示/操作応答、cutoff、エラー、試行番号を持つ。集計は5試行の最大値と中央値、失敗/打切り件数。原本内容・token・接続secretは含めない。

操作応答の性能記録にはinput ID、操作種別、page/generation識別、時計対応、inputReceived/handlerStart/stateCommitted/framePresented、inputDelay、全応答時間、計測可否を含める。時計と表示の証拠はcontracts/rendering.mdに従い、入力待ち時間を合否から除外しない。

## T018の所有期間の補足

- SourceSnapshotの取得時はWorkerのpostMessageが候補を同期キャプチャし、既存schemaで検証したDTOだけを返す。成功/失敗/abortはいずれも専用Workerとlistenerを終了する。公開前のdeep freezeと世代照合は維持する。
- ScoreSurfaceはViewerごとに独立したbody配下のowner、表示viewport、route内placeholder、observerを持つ。retire後は再公開しない。論理的な終了（abort・binding解除・非表示・hit testing不可）と、idleでの物理DOM撤去を分ける。finishedは所有DOMの撤去完了だけを表し、離脱の表示時刻の代用にはしない。
