# Score Import Contract: MusicXML version compatibility

既存仕様001の取り込み契約を、仕様007のMusicXML対応範囲について更新する設計契約。未実装の設計であり、対応済みの案内ではない。

## Input

既存 `POST /api/score-import/preview` のsame-origin、認証、multipart file/options、5MiB以内、PRESERVEを維持する。2.0/3.0/3.1/4.0のscore-partwiseを.xml/.musicxml/.mxlから受理する。拡張子やMIMEだけで中身を信用しない。MXLのcontainer.xmlで指定する主楽譜を選び、代替PDF/音声を主XMLと扱わない。

PUBLIC/SYSTEM形式の正常な外部DOCTYPEはネット取得せず解析する。一重/二重引用符・改行を許すが、内部subset/ENTITY宣言・危険なroot pathを拒否する。DOCTYPEに明示されたMusicXML版がroot版と不一致なら不正入力。SYSTEM共通URLから版を推定しない。

## Success / partial response

既存JSON envelope、HTTP200、Cache-Control:no-storeを維持。candidate/issues/metadata/validation/previewTokenに、既存のcanPractice/canGame等を含む構造を変えない。

- MUSICXMLのmetadata.formatVersionは実際の2.0/3.0/3.1/4.0。
- 新規変換のmetadata.converterVersionはscore-import-v2。MIDI/JSONも変換リリース識別子のみ更新し、形式版・音楽内容・利用可否は従来通り。
- 未解決演奏問題はBLOCKINGかつcanPractice/canGame=false。不完全だが安全に保持できる内容はpartialとして既存の確認・修正・保存手順へ返す。
- 形式・値域が有効でも解釈不能な設定指示やパート間の矛盾はBLOCKINGとする。安全な候補は確認・保存可能だが、未解決のまま練習・ゲームへ進めない。
- 表示だけの省略と、設定省略に対する既存の既定値補完はWARNINGとし、補完内容を示す。警告だけで演奏不可にしない。
- 30分のプレビュー期限とactor/candidate/issues/metadataの署名関係を維持する。

## Error response

既存 `{error:{code,message},requestId}` を維持し、raw parserメッセージ・XML断片・ローカルpathを含めない。

| 原因                                             | code                           | HTTP        | メッセージの要件                                           |
| ------------------------------------------------ | ------------------------------ | ----------- | ---------------------------------------------------------- |
| 未対応・未知・DOCTYPEでも確定できない欠落version | UNSUPPORTED_MUSICXML_VERSION   | 415         | 版を確認すること、対応版2.0/3.0/3.1/4.0を示す              |
| timewise/opus等の未対応root                      | UNSUPPORTED_MUSICXML_STRUCTURE | 415         | score-partwiseが対象であることと、その形式での書出しを案内 |
| その他既存の未対応形式                           | UNSUPPORTED_FORMAT             | 415         | 従来の形式案内                                             |
| 破損XML/ZIP、不正値、矛盾DOCTYPE、安全性違反     | VALIDATION_FAILED              | 422         | ファイル内容の確認。危険な内容の詳細を露出しない           |
| 入力/展開/件数/音数/span超過                     | 既存の上限code                 | 413         | 既存上限と分割・縮小の案内                                 |
| 同一利用者の変換中                               | IMPORT_BUSY                    | 429         | 完了後の再試行                                             |
| 期限超過                                         | IMPORT_TIMEOUT                 | 504         | サイズ・内容を見直した再試行                               |
| 未認証/権限不足/取消                             | 既存code                       | 401/403/499 | 既存の案内                                                 |
| リソース不足・一時障害                           | TEMPORARY_FAILURE              | 503         | 時間を置いて再試行                                         |

エラー分類はimport-http.tsで安全な定数に対応させる。workerの英大文字・数字・underscore/80文字上限を満たし、プロセス全体の例外公開方法は変えない。上限・期限のメッセージ改善が必要な場合も既存codeとHTTPを維持する。

テンポ0・負数、設定の数値項目に非数値が入る等の不正な形式・値域はVALIDATION_FAILED（422）で拒否する。設定の省略や有効な指示の解釈不能、パート間の矛盾とは区別し、不正値を既定値に置換しない。

## Revalidate / save / read

既存 `/api/score-import/revalidate` とsaveImportの入出力を維持する。修正で元version/converterVersionを書き換えない。metadata.formatVersion改変、別actor、不正署名、期限切れは従来通り拒否。確認操作でBLOCKINGを解除しない。

保存したsettings.jsonとDB ImportMetadataは同じ元版を持つ。保存後や提案の再表示でも一致する。新しい候補を保存する前に認可し、失敗・取消では既存楽譜を部分更新しない。過去のmetadata文字列/null/成果物欠落を新対応版enumで拒否しない。

## UI

既存ImportPreviewの対応形式案内を対象4版へ更新し、MusicXMLの実版を表示する。MIDI/JSONをMusicXML版として表示しない。既存の警告確認、再検証、取消、保存、同一key再試行を維持する。新しい画面・アップロード導線は追加しない。

分類と試験範囲は[compatibility-matrix.md](compatibility-matrix.md)、具体的な検証操作は[../quickstart.md](../quickstart.md)参照。

## Menuett原本で判明した版欠落の限定互換性

rootのversionが欠落し、rootと一致する標準Recordare PUBLIC DOCTYPEが対象4版のいずれかを明記する場合は、その版をmetadata.formatVersionに用いる。MUSICXML_VERSION_FROM_DOCTYPE（INFO）で由来を示す。SYSTEMの共通URL、版のない宣言、未知/対象外版は復元根拠にしない。明示root版をDOCTYPEで上書きせず、矛盾は422。反復のBLOCKINGは復元後も維持する。
