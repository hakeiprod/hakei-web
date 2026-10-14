# Server Actions and UI Contracts

既存App RouterのServer Actionsを公開境界として扱う。URL名は画面経路であり新しい汎用REST APIではない。取り込みプレビューだけは[取り込み契約](score-import.md)のRoute Handlerを利用する。
全Actionに認証、入力検証、対象の認可を行い、権限はクライアント値から受け取らない。
サーバーの一覧・ページ読取も同じ認可サービスを通す。

## 共通DTO

成功: `{ok:true,data,requestId}`。期待される失敗: `{ok:false,error:{code,message,fields?,retryable},requestId}`。
code: UNAUTHENTICATED、FORBIDDEN、NOT_FOUND、VALIDATION_FAILED、CONFLICT、
TRUST_UNCONFIGURED、LIMIT_EXCEEDED、TEMPORARY_FAILURE。
非公開の対象を外部へ漏らさない読取はNOT_FOUND。
HTTP対応が必要なRoute Handlerでは順に401/403/404/422/409/503/413/503。
予期しない障害はrequestId付きで記録し、DB内部情報や秘密情報を返さない。
同一主体・操作・idempotencyKeyの再送は同じ結果。異なるpayloadはCONFLICT。

## 操作

| Action / screen                 | Input                                                                                                            | Result / authorization                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| listRepositories / repositories | cursor?,limit<=50                                                                                                | 閲覧可能な一覧だけ                                                          |
| createRepository                | name,visibility,editScope,idempotencyKey                                                                         | ログイン必須、本人をowner/ADMINに                                           |
| updateRepository                | repositoryId,expectedAccessVersion,visibility,editScope                                                          | ADMIN、版競合確認                                                           |
| setMember                       | repositoryId,userId,role,canMerge,expectedAccessVersion                                                          | ADMIN。最後の管理者を除去不可                                               |
| readScore / score/[id]          | scoreId,revisionId?                                                                                              | 現在の閲覧権限で版を返す                                                    |
| createScore / score/create      | repositoryId,validatedScoreData,dataFormatVersion,idempotencyKey                                                 | 編集可能者。初版とScoreを同時作成                                           |
| submitProposal                  | scoreId,baseRevisionId,proposedData,summary,idempotencyKey                                                       | 編集スコープ内。原本不変                                                    |
| readProposal / proposals/[id]   | proposalId                                                                                                       | 元楽譜の閲覧権限、差分と基準版、状態、canMerge                              |
| mergeProposal                   | proposalId,expectedProposalVersion,expectedRevisionId,expectedRepositoryCommitOid,idempotencyKey                 | 最新の権限/信頼度で判定。成功時revisionId/commitOid/mergeRecord/syncPending |
| rejectProposal                  | proposalId,expectedProposalVersion,reason,idempotencyKey                                                         | マージ権限。自己却下は信頼度変動なし                                        |
| withdrawProposal                | proposalId,expectedProposalVersion                                                                               | 提案者だけ、非採用のみ                                                      |
| archiveScore                    | scoreId,expectedRevisionId                                                                                       | ADMIN。参照版は保持                                                         |
| publishTrustRule / admin/trust  | 数値設定,expectedPolicyVersion,reason,idempotencyKey                                                             | OPERATORのみ。有効化前検証、不正は旧設定維持                                |
| adjustTrust                     | targetUserId,desiredScore,expectedRuleId,reason,idempotencyKey                                                   | OPERATORのみ。前後値と差分を監査                                            |
| reviewUser                      | targetUserId,value,expectedVersion?                                                                              | ログイン必須、自己不可。1対象1件の現在値を更新                              |
| readTrust                       | userId                                                                                                           | 自身の値と算出根拠。管理画面はOPERATORのみ                                  |
| saveImport                      | repositoryId/scoreId?,baseRevisionId?,candidate,issues,metadata,previewToken,acknowledgedIssueIds,idempotencyKey | 新規保存または編集案の提出。原本への直接上書き不可                          |
| savePractice                    | clientSessionId,scoreRevisionId,conditions,status,eventBatches                                                   | 本人+楽譜閲覧。サーバー再評価結果を返す                                     |
| listPractice / practice/history | cursor?,comparisonKey?                                                                                           | 本人の結果要約だけ                                                          |
| readPractice / practice/[id]    | sessionId                                                                                                        | 本人のみ。楽譜本文は現在の閲覧権限が必要                                    |
| deletePractice                  | sessionId,idempotencyKey                                                                                         | 本人のみ。入力/結果削除と集計再計算                                         |

信頼度ルールの入力項目・検証はdata-model/researchを参照。
userId/score値/運営ロールをsavePracticeでクライアント指定させない。
クライアントのScore JSONは最初に構造、数値、参照、音楽情報を検証し、保存前にも確認する。

## マージの採用確定とGit同期

[Git版管理契約](git-versioning.md)の準備→DB採用→ref同期を使用する。
mergeProposalはexpectedRepositoryCommitOidも受け取る。
確定済みはAPPLIED(commitOid,revisionId,syncPending)、処理中はIN_PROGRESS(operationId)を返す。
IN_PROGRESSを成功扱いせず原本を変更しない。APPLIED後の同期遅延は採用失敗として再計上しない。
新規楽譜保存・取り込み・archiveにも同じ操作receiptと採用経路を適用する。
同時マージの権限/信頼度/基準先端はDB採用transaction内で確認し、Git本体への書込は外側で行う。

## UIと非同期状態

編集画面: 原本と下書きの差分、基準版、提出状態、保存中、失敗、再試行、競合後の再提出を示す。
信頼度不足は編集案作成を妨げず、マージボタンと理由を表示する。ボタン非表示だけで認可しない。
招待限定のメンバー管理では編集権限とマージ権限を区別する。
運営設定画面は値、重み、基準、理由、適用版を確認して有効化する。
操作はキーボードで到達可能にし、入力ラベルとエラー説明を付け、判定は色だけに依存しない。
保存失敗では下書きを消さず、再送で原本や実績が重複しない。

## 取り込みと利用制限

saveImportは署名・期限・現在のユーザー・候補ハッシュ・設定・診断を検証する。
警告は現在の候補のissueIdを全て確認してから保存。BLOCKINGは保存を拒否しないが利用制限を保持する。
savePracticeと練習/ゲーム開始は参照版のサーバー算出RevisionValidationを必須とする。
既存楽譜への変換結果はsubmitProposalと同じ採用経路へ送り、低信頼度ユーザーでも原本を書き換えられない。

## 認証の利用者操作

ヘッダーのログインはnext-authのsignInで組み込み画面へ、ログアウトはsignOutでセッションを終了する。
ログイン済み状態・処理中・エラーを表示し、認証エラーは組み込み画面の案内を再利用する。
遷移先は許可された同一オリジンのURLに限定する。
ログアウト後に本人の履歴・非公開本文のキャッシュと表示を破棄し、サーバー側のアクセスも拒否する。

操作resultの再送・保持はgit-versioning.mdのMutationReceiptに従う。
採用されたOIDをDB索引で認可してから、Gitのscore.json等を読んでDTOを構成する。
任意のref/OID/pathをクライアントから読み出せるGit APIを公開しない。
