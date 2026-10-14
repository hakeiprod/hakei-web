# Data Model

既存User/Account/Session/VerificationToken/Resourceを維持する。
認証Sessionと演奏PracticeSessionを別名で区別する。日時はUTC、画面表示は利用者のタイムゾーン。
新規IDは不透明な文字列、既存Score.idは整数を維持。全入力はZodで検証する。

## リポジトリと楽譜

| Entity           | Fields / relationships                                                                                                              | Rules                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| User             | 既存id、serviceRole(USER/OPERATOR)                                                                                                  | 運営だけが運営権限を付与。リポジトリ管理者と別                                                                      |
| ScoreRepository  | id,name,ownerId,visibility,editScope,accessVersion,gitStorageKey,acceptedCommitOid nullable,acceptedGeneration,syncState,archivedAt | 初期PRIVATE/INVITED。ALL_USERSはPUBLICのみ。採用本文はGit、採用先端はDBのOID。PENDING_PUBLICATION中は次の採用を停止 |
| RepositoryMember | repositoryId,userId,role(ADMIN/EDITOR/VIEWER),canMerge                                                                              | 複合一意。canMergeは招待限定のEDITORに管理者が付与。VIEWERはマージ不可。ADMINは必ずマージ可                         |
| Score            | 既存id,data（移行時のみのlegacy JSON）、repositoryId nullable,currentRevisionId nullable                                            | nullは所有者不明の移行待ち。管理された本文はGitから読む。dataを採用内容のミラーとして更新しない                     |
| ScoreRevision    | id,scoreId,number,repositoryId,commitOid,path,dataHash,dataFormatVersion,authorId nullable,createdAt,proposalId nullable            | (scoreId,number)一意。不変のGitコミットを指す索引。JSON本文をDBへ複製しない                                         |
| EditProposal     | id,scoreId,baseRevisionId,baseRepositoryCommitOid,proposalCommitOid,proposalRef,authorId,status,version,createdAt,updatedAt         | 基準版と同じScore。提案本文はGit。SUBMITTED後のコミットは不変                                                       |
| MergeRecord      | proposalId unique,revisionId unique,actorId,occurredAt,authorizationKind,trustScore/threshold/ruleVersion nullable,accessVersion    | ALL_USERSでは信頼度値と版を必須。INVITEDでは付与権限を記録                                                          |

閲覧: PRIVATEは管理者、INVITEDはメンバー、PUBLICは全員。
編集案: ALL_USERSは認証済み全員、INVITEDはADMIN/EDITOR。
マージ: ALL_USERSは運営設定の最新信頼度 >= 最新基準。管理者の迂回なし。
INVITEDはADMINまたはcanMergeのEDITORのみで信頼度不要。
スコープ切替はaccessVersionを増やし、未採用案も現在の権限で再評価する。

EditProposal状態: DRAFT → SUBMITTED → MERGED / REJECTED / CONFLICTED。
DRAFTは提案者だけが編集。SUBMITTED以降の内容は不変。
競合後は新しい基準版の新提案を作り、元の案を履歴に残す。提案者は非採用案をWITHDRAWNにできる。
却下はマージ権限のあるユーザーが理由付きで実行。自己却下は信頼度の加減点対象外とする。
採用はGit object準備→Serializable DB確定→ref同期。詳細は[Git版管理契約](contracts/git-versioning.md)。

## 信頼度・運営設定

| Entity           | Fields / relationships                                                                                                                                                           | Rules                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| TrustRuleVersion | id,version,initialScore,wAdmin,wOutcome,wReview,acceptedDelta,rejectedDelta,reviewFactor,minReview,maxReview,minScore,maxScore,mergeThreshold,status,operatorId,reason,createdAt | 有限数値、重み条件はresearch参照。DRAFT→ACTIVE→RETIRED、不変の有効版         |
| TrustPolicyState | singletonId,activeRuleId nullable,version                                                                                                                                        | 設定の有効化・マージで同じ行を読む。未設定はfail closed                      |
| TrustEvent       | id,userId,type(ADJUSTMENT/ACCEPTED/REJECTED),sourceId unique,actorId,value,reason,createdAt                                                                                      | 運営調整以外は提案の最終状態から一度だけ生成                                 |
| UserTrustReview  | id,reviewerId,targetId,value,version,updatedAt                                                                                                                                   | (reviewerId,targetId)一意、自己評価不可。履歴はAuditEventへ                  |
| TrustSnapshot    | userId,ruleId,inputVersion,score,calculatedAt                                                                                                                                    | キャッシュ。認可時は入力版一致を確認し、古ければ同じトランザクションで再計算 |
| AuditEvent       | id,actorId,entityType,entityId,action,before,after,reason,createdAt                                                                                                              | 運営操作・権限変更・評価変更。秘密値や演奏生データは入れない                 |

算出式はresearch.md参照。合成は固定の宣言的形式、値と重みは運営設定。
設定変更はルールの新版を有効化し、過去のマージ根拠は変更しない。
レビュー再送は同じ評価の更新として扱い、重複加算しない。
運営直接調整の前後値は当時のルールで監査。別版への変更は監査可能な再計算とする。

## 演奏・評価・達成

| Entity                | Fields / relationships                                                                                                                                                       | Rules                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| EvaluationRuleVersion | id,version,practiceWindowUs,perfectWindowUs,goodWindowUs,weights,extraPenalty,status                                                                                         | 不変。初期値はspecの仮定を使用。信頼度ルールと別                         |
| PracticeSession       | id,userId,clientSessionId,scoreRevisionId,trackId,rangeStartBar,rangeEndBar,tempoScale,calibrationUs,mode,status,ruleId,startedAt,endedAt,deviceLabel optional,comparisonKey | (userId,clientSessionId)一意。本人のみ。機器IDは公開・認証用途に使わない |
| PerformanceEventBatch | sessionId,batchIndex,events,checksum                                                                                                                                         | 複合一意、同じindexで異なる内容は競合。整数相対時刻で保存                |
| EvaluationResult      | sessionId unique,algorithmVersion,summary,perNote,perBar,score,meanAbsTimingUs nullable,computedAt                                                                           | サーバー再評価。入力と版の参照を固定。クライアント値は保存の正ではない   |
| Achievement           | userId,type,comparisonKey,sessionId                                                                                                                                          | 最初の完了・自己ベスト更新の表示用。同じ完了再送で増やさない             |

PracticeSession状態: CREATED → RECORDING → COMPLETED / INTERRUPTED → DELETED。
クライアントはローカル下書きを保持。サーバーのCREATEDレコードなしの未保存演奏も可能だが、
保存時に認証と閲覧権限を確認する。完了後の再送は同じキーなら同じ結果、異なる内容なら409。
離鍵がない中断はnote-offを捏造せずopenNoteとして保持する。

comparisonKeyは版/モード/トラック/小節範囲/テンポ/判定ルール/遅延補正の正規化値のハッシュ。
練習の自己ベストは音高正確率、同率なら平均絶対時刻ずれ。対応音なしはnullで数値より劣後。
ゲームはスコア。完全同率は先の記録を保つ。中断を完了数・自己ベストに含めない。
削除時は演奏と結果を消し、残る完了記録から達成・自己ベスト・完了回数を再計算する。

## 移行・索引・整合性

1. 追加テーブルとnullable参照を導入。既存Scoreの数・JSONハッシュを記録する。
2. 各Scoreに元JSONを保持するGit初版コミットとDB索引を作る。形式が無効なら元JSONを保護し移行対象外として報告。
3. 所有者情報がない既存Scoreは未管理として隔離。運営が対象IDと管理者を明示してリポジトリへ割当。
4. idとJSONハッシュの一致、版参照、旧URL互換を確認後に認可付きの経路へ切替。
5. 既存Score.dataは検証済み移行元として保全し、新版で更新しない。全管理対象の読取をGit+索引へ切り替える。

索引: repositoryId/currentRevision、proposal(scoreId,status,createdAt)、member複合キー、
session(userId,comparisonKey,status,startedAt)、event(userId,type)、review(targetId)、監査(entityId,createdAt)。
FKで異なるScoreの版を混在させず、削除cascadeで参照される楽譜の版を失わない。
DBトランザクションでGit書込、外部OAuthや音声解析を実行しない。解析後に保存整合性を検証する。

## 取り込み・変換診断

| Entity                        | Fields / relationships                                                                               | Rules                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| ImportPreview（永続化しない） | candidate,issues,format,formatVersion,converterVersion,options,previewToken                          | 変換中だけ。元bytesと整列前コピーをDBへ保存しない    |
| ImportMetadata                | revisionId unique,format,formatVersion,converterVersion,mode,grid?,sourceName?,warningAcknowledgedAt | 保存された変換設定。sourceNameは表示用でパスではない |
| ConversionIssue               | revisionId,issueId,code,severity,fieldPath?,bar?,track?,message,status                               | WARNING/BLOCKING。未解決BLOCKINGは演奏不可           |
| RevisionValidation            | revisionId unique,validatorVersion,canPractice,canGame,unresolvedIssueIds                            | サーバー算出。クライアントの可否を信用しない         |

ScoreRevision/EditProposalのGit treeにconversionMetadataと診断を添付し、DBにはハッシュ/利用可否の照合用投影を持つ。本文/設定の正はコミットにある。
完全な候補は既存Sheet export形式。不完全候補はconverted-partial-v1でknown値と未解決の参照を保持する。
形式タグで区別し、既存import()へ不完全候補を渡さない。既知部分のみの表示と欠落マーカーを用意する。
診断は修正対象のフィールドへの参照を持ち、修正内容の確認と構造・音楽検証が通った新版だけでRESOLVEDへ。
元版の診断と評価結果を後から変更しない。表示情報の欠落だけならcanPractice/canGameはtrue。

状態: SELECTED → CONVERTING → PREVIEW_READY → CONFIRMED → SAVED、またはCANCELLED/FAILED。
保存失敗ではPREVIEW_READY/CONFIRMEDの変換済み下書きを保持する。
サーバー元bytesはプレビュー処理終了時に解放、ブラウザーFile参照は保存完了・中止・画面終了で解放する。
選択切替では保持しているFileから再変換し、整列前の情報を別の永続レコードにしない。
保存後の再変換は再アップロードする。MIDI練習のPerformanceEventBatchは別機能として保存する。

## Git採用・復旧モデル（共通基盤で実装）

| Entity            | Fields / relationships                                                                                                                                                                                                     | Rules                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| GitPublicationJob | operationId unique,repositoryId,expectedOldOid,targetOid,generation,status,attempts,lastError                                                                                                                              | DB採用と同時作成。main同期は何度再開しても同じ結果。成功前は次の採用を止める       |
| MutationReceipt   | actorId,operation,key,payloadHash,operationId,repositoryId,scoreId?,proposalId?,expectedRepositoryOid?,expectedRevisionId?,preparedCommitOid?,preparedRef?,stage,status,result,leaseOwner?,leaseUntil?,createdAt,updatedAt | (actorId,operation,key)一意。同key異内容はCONFLICT。確定resultを業務更新と同時保存 |
| UserTrustState    | userId unique,inputVersion                                                                                                                                                                                                 | 実績/評価/運営調整と同一transactionで版を増やす                                    |

GitPublicationJob: PENDING → RUNNING → DONE / REPAIR_REQUIRED。リース期限後は排他取得して回復。
MutationReceipt: PREPARING → APPLIED / CANCELLED、回復可能な未確定はPREPARINGのまま。
採用版/練習参照のOIDは保持refでGCから保護する。DB索引だけを根拠にGit objectを消さない。
ImportMetadata/ConversionIssue/RevisionValidationのDB行はGit内の版付き内容の投影として扱い、
commitOidと内容ハッシュを検証して使う。過去版の本文は採用済み索引か本人の参照版に限り認可する。

MutationReceipt.stageはCLAIMED → OBJECT_PREPARED → DB_APPLIED → REF_PUBLISHED。
OBJECT_PREPAREDへ進める際に対象・基準・preparedCommitOid/refを保存してから回復可能とする。
Git ref作成後・DB項目記録前の停止では、operationIdから生成した固定refを検索してobjectを検証し、
既存receiptのrepositoryId/scoreId/基準と一致する場合だけ準備状態を復元する。
CLAIMEDでobjectもない操作は元候補なしで再変換せず、再送または期限切れ取消にする。
DB_APPLIED以降は保存したresult/jobから同期のみ再開する。
GitPublicationJob・MutationReceiptは移行前に作成し、UserTrustStateと編集案/信頼度モデルはUS2で追加する。
共通採用エンジンは操作種別で認可・DB更新を選ぶ。移行は運営専用で、信頼度実績やMergeRecordを生成しない。
