# Score Import Contract

## 認定範囲

| Format       | Accepted                                                      | Preserved / diagnostics                                                                                              |
| ------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| MusicXML 4.0 | score-partwise .musicxml/.xml、.mxlのcontainerが指定する主XML | 音高・音価・休符・和音・声部/譜表・タイ・duration/divisionsで表す連符・拍子/調号/テンポ。歌詞・装飾/印刷は未対応警告 |
| SMF 1.0      | format 0/1、PPQN正整数、.mid/.midi                            | 打鍵/離鍵/velocity・チャンネル・トラック・テンポ/拍子/調号。記譜上の綴り・休符等の補完は通知                         |
| 楽譜JSON     | 既存Core.createパラメーター、既存Sheet.exportの完全構造       | 明示的に構造判定して標準形式へ。任意JSONや混在構造を拒否                                                             |

MusicXMLのscore-timewise/opus/他版、SMF format 2/SMPTE、MIDI 2.0、PDF・画像はUNSUPPORTED_FORMAT。
MusicXMLの反復/別エンディングなど演奏順を変える未対応表現、微分音・無音高音符、
パート間で両立しない拍子/調号/テンポはBLOCKING。レイアウトだけの欠落はWARNING。
MIDIの未完了離鍵は長さ不明としてBLOCKING、同一track/channel/pitchは未完了打鍵を順に閉じる。同音重複で対応付けが曖昧な場合もBLOCKINGとして示す。
pitch bend・サステインは採点表現外で音楽情報の欠落として警告し、音高/音価の確定が必要ならBLOCKING。
ヘッダー構造・チャンク長・XML構文不正はFATAL、保存候補を作らない。

## 共通変換器（s-core）

input={bytes:Uint8Array,formatHint?,options}。
output={candidate,issues,metadata,canPractice,canGame}。
既存形式parserとconverterを包み、Input bytesを書き換えない。
File、DOM、HTTP、Prisma、署名処理に依存しない。

issue={id,code,severity:INFO|WARNING|BLOCKING,fieldPath?,track?,bar?,message}。
不明な音高・時刻を無通知の既定値で埋めない。補完した拍子・調号・テンポは具体的な値と根拠を通知。
既定補完が意味を確定できる場合はWARNING、確定できない場合はBLOCKING。
候補の既知値と欠落参照を保持し、曖昧な音符はプレビューで欠落として示す。
保存後もBLOCKINGは警告確認だけでは解除できない。
MusicXMLは小節内のbackup/forwardと声部ごとの時刻を検証し、和音構成音でカーソルを進めない。
標準XMLの最初のMusicXML rootfileを選び、PDF/音声の代替rootfileを別の曲として取り込まない。

## MIDI変換設定

mode=PRESERVE（既定）またはQUANTIZE。
QUANTIZEのgridは四分音符=1拍として、1/1、1/2、1/4、1/8、1/3、1/6拍から選ぶ。
画面では四分・八分・十六分・三十二分・八分三連・十六分三連として表示する。
グリッドと元tick/PPQNは有理数として比較し、浮動小数の誤差で境界判断を変えない。
onsetとdurationを別々に最近傍へ丸め、同差は小さい側。durationが0以下ならgridへ補正し警告。
end=onset+durationとして整合を保つ。テンポイベント時刻、音高、トラック/チャンネルは整列で変更しない。
原点は曲の開始。設定切替は元bytesから再変換し、前の丸め結果を入力にしない。
変更した音符数と開始位置・音価の差分を表示する。PRESERVEへ戻すと元の値を再現する。

## HTTPプレビュー

POST /api/score-import/preview、Node runtime、認証必須。
multipart={file,options}。MIME/拡張子をヒントにし、XML root/MThd/ZIPと内容を検証する。
XML外部参照を取得せず、外部エンティティ展開を拒否する。標準MusicXMLの外部DOCTYPE宣言はネット取得せず扱う。
MXLはMETA-INF/container.xmlの内部rootfileを検証し、外部パス・絶対パス・../を拒否する。
ZIP全体をdiskへ展開せず、エントリー数・圧縮/展開量・処理時間を制限する。

200={candidate,issues,metadata,previewToken}。tokenはサーバー署名、actorId/候補とissuesとmetadataのハッシュ、
converterVersion、expiryを含み、有効期限30分。元bytes、整列前音符列をtokenへ含めない。
保存時は元ファイルなしで署名された候補を検証し、未知のfieldを変更したpayloadを受け付けない。
プレビューの期限切れは再アップロードを案内し、変換済み下書きを勝手に消さない。

失敗: 401認証、413容量/展開上限、415未対応、422形式不正、429変換要求過多、
503変換リソース不足、504処理期限。内容・機密データをログへ出力しない。
初期運用値: 入力5MiB、展開20MiB/100件、10,000音、10秒、利用者ごと同時1要求。
同時実行上限と集計はサーバー側で適用し、複数インスタンスでは共有カウンターを必要とする。

## 保存と一時データの寿命

saveImportはserver-actions.md参照。変換設定、警告、変換器版、選択した結果をGit treeへ保存し、採用索引/可否の投影だけをDBへ保存する。
サーバー元bytesはrequest完了/finallyまたはワーカー終了で参照解放し、永続ストレージ・ログへ出さない。
ブラウザー元Fileは同一取り込み画面のメモリ内だけで持ち、保存完了・中止・離脱で参照とURLを解放する。
元FileをlocalStorage/IndexedDB/サービスワーカーキャッシュへ保存しない。
元の楽譜をPRESERVEで変換した結果そのものは保存対象。別のrawファイル・整列前コピーを残さない。
保存前の修正は下記の再検証経路を使い、保存後の修正は編集案経路で行う。
いずれも新版または新しい候補のvalidationにより利用可否を再検証する。

## 保存前の修正・再検証

POST /api/score-import/revalidate、Node runtime、認証必須。
input={originalCandidate,originalIssues,metadata,previewToken,corrections}。
元署名とactor/用途/期限/各ハッシュを検証し、許可された音楽フィールドの修正だけを適用する。
診断一覧の削除・可否フラグの書換・変換設定の差替をクライアントから受け付けない。
修正フィールドと関連する音楽情報を再検証し、実際に解消したBLOCKINGだけをRESOLVEDにする。
元ファイルなしでは解消を確認できない診断は残し、修正理由と確認対象を利用者に示す。
outputは新candidate/issues/validationと新previewToken。修正した内容に対応する警告確認を改めて要求する。
saveImportは新しい候補の署名を検証する。旧候補へ戻る保存は旧署名の候補としてのみ受け付ける。
期限切れは再アップロードが必要。単なる修正依頼で期限を延長し続けず、最初の変換から30分を上限とする。
元ファイルを再アップロードさせずに保存前の修正を行え、元bytesの永続保存は行わない。
署名はNode.js標準cryptoを使い、暗号アルゴリズムを自作しない。
