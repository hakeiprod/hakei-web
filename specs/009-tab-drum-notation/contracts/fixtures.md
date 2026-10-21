# Fixture / Evidence Contracts

既存Manifest v1・6段階（import/roundtrip/persisted/document/svg/visual）・expectedOutcome/requiredStages/rejectionStageを再利用し、既存render/rejectを維持してexpectedOutcome=partialを追加する。partialは保存可能な不完全候補を表し、import/roundtrip/persistedを要求し、期待partial・既知値・未対応元情報・診断を検証する。document/svg/visualとrejectionStageは要求せず、描画非適用を合格描画にしない。保存テストのroundtripはpartialのJSON/schema往復としSheetへの強制昇格をしない。追加selectorはtabValue/string/fret/anchorRole、DrawingRecordに実際の数字列と位置を追加する。旧selectorは変更しない。TAB用value判定はmetadataだけでなく数字Glyphの実codepoint列と合成文字、世界座標を評価する。SVG文字欠落・順序違い・値metadataだけ正常・別弦への移動を不合格にする。

## Suite

allowlist: notation → 既存notation/manifest.jsonとspecs/008-extend-score-notation、tab-drum → tab-drum/manifest.jsonとspecs/009-tab-drum-notation。runner引数 --suite notation|tab-drum、省略はnotationで後方互換。--persistedは既存機能を維持。両suiteを既存/dev/notation/fixturesで区別して表示しproductionは非公開。

reportDirectoryやテスト名の008固定をsuite設定へ移動する。各suiteのverification-results.json/visual-results.jsonを個別保存し、任意パスは受け付けない。入力・期待値・layout・現在描画ソースとフォントのfingerprintが一致する最新段階だけ採用する。report破損はエラー、欠落／失効はpending。新描画ソースで008結果が失効したら自動結果を再生成し、目視は再確認する。

## 必須独立条件

- TAB: 6弦の各弦位置6件、4弦の各弦位置4件、0・1桁・2桁・36、同音異運指、同時弦、明示tuning保持、tuningなし、pitchなしでも表示、各5音価、付点、各5休符、上下stem/flag、beamと前後hook、同小節／小節越え／改行／改ページtie。
- ドラム: 9楽器各1件、normal whole/half/black、x、表示位置変更で楽器不変、楽器対応不明でも表示、各5音価、各5休符（percussion譜表、rest:true、pitch:null、打音用percussion表記なし）、旧数値pitch休符の往復、付点、上下stem/flag、beamと前後hook、複数声部、同時打音。
- 複合: 通常＋TAB、通常＋ドラム、3種混在、同一part通常＋TAB、4線／6線先行の累積配置、異高さtrack先行、小節header共通位置、各種行／ページ境界、再layout不変。
- 不正／境界: 弦0・範囲超過、fret -1/小数/37、同弦相反、表記kind矛盾、無音高の通常音符、不明楽器参照、未対応符頭・奏法、音高とtuning矛盾、未知共有event／不一致。入力条件表に従い、完全表示＋警告のrender、保存可能なpartial、JSON不整合拒否のrejectを別fixtureにする。未対応情報の保存後保持も検証する。nullの通常非休符は完全候補で拒否、不完全候補で保持を別条件にする。打楽器休符への打音表記・非空タイは拒否、休符のnullをMISSING_PITCHとしないことと音声／timelineへの発音混入0を対照確認する。
- 回帰: 008全条件、旧JSON、数値Core/MIDI、音声とpractice既存挙動、null直接音声変換拒否、併記の余分な打鍵0・曖昧対応の演奏不可。

各fixtureは1主対象・由来・期待値・FR/US参照を持つ。組合せ条件は単独と別にし、大きい入力の理由を記録。正常に譜面描画できる全TAB／ドラム条件は全6段階を必須にする。不正入力は適用段階だけ要求する。数字・位置・符頭・譜線貫通・tie端点の誤りを含む対照結果を条件単位で用意する。

## 記録

自動runnerが未実施persisted/visualをpassにしない。目視はvisualChecklist IDごとの結果、browser/reviewer、入力・期待値・layout・rendererRevision・executedAtを記録。利用者申告は申告として記載し、範囲不明を全件合格にしない。DBは今回保留。最終コードとconverter/validator版更新後、両suiteの自動結果を再生成し、失効した008/009の各必須目視条件を再確認して現在版の記録を作る。途中の記録は過去版の結果として保持する。全必須証跡がそろうまでSC全達成を宣言しない。


## 実装時の判定拡張

selector.direction=up/downを符幹の実座標から導出する。staffGap assertionは数字列の実ink境界と同じ譜表・小節・ページの譜線を比較し、指定余白内の交差を不合格にする。relativePositionのoffsetは指定基準からのstaff space差で、TABの弦位置とドラムの明示位置を検査する。SVGの親translateと実文字・フォント境界を評価し、metadataのみを根拠としない。これらもコピーへ誤位置・線貫通を注入した対照結果で検証する。
