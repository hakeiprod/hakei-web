# Git Score Versioning Contract

## Storage and identity

サービスのScoreRepositoryごとにGit bare repositoryを永続ボリューム上に置く。
アプリのソースリポジトリと分離し、利用者へGitの認証情報や直接のclone/push経路を公開しない。
既存Git CLIをNode.js spawn/execFileの引数配列で呼ぶ。shellを介さず、生成したID・検証済みOID・
固定のref/pathだけを使用する。利用者の名前・ファイル名をref/path/オプションに使わない。
Git hooksを無効にし、サービスが管理する設定だけを読む。外部remoteや任意URLを設定しない。

Git内容: scores/<scoreId>/score.json、import.json、diagnostics.json、validation.json。
JSONは安定したキー順・ID順で保存。派生レイアウトは版の内容へ混在させない。
インポート元のMusicXML/MIDI bytes、整列前の別コピー、演奏記録、認証情報をコミットしない。
OIDは固定40桁を仮定せず、repoのobjectFormatに応じて検証する。
DBのScoreRevisionはcommitOid/path/dataHash/形式を持つ索引で、版の本文はGit blobが正となる。
DBのrepository.acceptedCommitOidが採用済み先端の正。refs/heads/mainはその同期可能な投影。
利用者への版IDは既存revisionIdを維持し、対応するrepositoryId/commitOidを返す。

## Proposals and commits

提出は採用済みコミットを基準に対象Scoreだけを変更したcommitを作り、
refs/proposals/<generatedId>に保持する。他Scoreのtreeを変更する候補を拒否する。
EditProposalはbaseRepositoryCommitOid、baseRevisionId、proposalCommitOidとrefを記録する。
提出後のcommitは不変。下書きは採用前の候補として扱い、提出前だけ修正できる。
初版では自動的なJSON行マージをしない。基準repo先端が変われば別Scoreの変更でもCONFLICTとし、
最新の版から再提出する。保守的な競合検知を初版のトレードオフとする。
採用コミットのparentsは旧採用先端とproposalCommitOid、treeは検証済み候補。
createScore・archive・移行も同じ採用プロトコルを使用する。archiveは本文の過去版を削除しない。

## Atomic acceptance without a distributed transaction

GitとPostgreSQLを単一のトランザクションにはしない。Git objectの準備とDBでの採用確定を分ける。

1. MutationReceiptを主体/操作/keyとpayloadHashで取得。候補を検証してGit objectを永続化し、
   refs/operations/<operationId>へpinし、receiptの対象・基準・preparedCommitOid/refとstageを記録する。書込完了・object読取/hash検証ができなければDB採用に進まない。
2. 短いSerializable DB transactionでrepo行をロックし、syncState=READYを確認。
   現在のACL/accessVersion、trust inputVersion/activeRule、基準repo先端とScoreの基準版を再確認する。
   Gitへの外部書込はこのtransactionに含めない。
3. repo.acceptedCommitOid/acceptedGenerationを条件付き更新し、ScoreRevision索引とcurrentRevisionId、
   MergeRecord、proposal状態、有効TrustEvent/inputVersion、MutationReceiptの確定結果、
   GitPublicationJobを同時コミット。repo.syncState=PENDING_PUBLICATIONにする。
   このDB commitが採用の確定点。準備objectだけでは利用者へ採用済みと表示しない。
4. publication workerはDB上のrepoを排他取得し、最新acceptedCommitOidを読み、
   Git update-refの旧OID比較でmainを同期する。既に同じOIDなら成功として扱う。
   DBのjob=DONE/repo=READYを更新する。mainが不明なOIDなら上書きせずREPAIR_REQUIREDを返す。

PENDING_PUBLICATION中は読取をDB採用OIDから行えるが、そのrepoの次の採用は待機させる。
遅れたworkerが新しい先端を古い値へ戻すことを防ぐ。ACL/設定の変更はDBで継続可能。
確定後の復旧は既に採用された操作の同期であり、その後の信頼度変化で巻き戻さない。
APIはAPPLIED(commitOid,revisionId,syncPending)か、未確定IN_PROGRESS(operationId)を返す。
確定済み操作は同期障害で「失敗」に変えず、再送は同じ採用結果を返す。

## Failure and recovery

| Stop point             | Recovery                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------- |
| 準備object前           | 確定なし。元候補から再試行                                                              |
| 準備object後・DB確定前 | staging refを保ち、現在の権限/先端を再確認して再試行。取消なら未採用objectを後で清掃    |
| DB確定後・main更新前   | GitPublicationJobから再開し、DB採用OIDへ同期。採用/信頼度実績を再計上しない             |
| main更新後・DONE前     | 同じOIDを確認してjobをDONEへ。Git commitを二重作成しない                                |
| object欠損/参照不一致  | REPAIR_REQUIRED。新しい採用を止め、バックアップ復旧・整合性確認まで公開本文を推測しない |

Git CLIの一時障害には有限の再試行と運営通知。GCは採用版・編集案・練習参照・準備操作を
refs/revisions、refs/proposals、refs/operationsでpinした状態で行い、参照objectをpruneしない。
DBとGitは同じチェックポイントの組でバックアップし、復旧時にDBが参照する全OIDを検証する。
初版は永続ディスクのNodeサービス+回復workerを前提。書込不能/一時ディスクだけの環境には配置しない。

## Trust and idempotency

UserTrustState(userId,inputVersion)を用意。評価/実績/運営調整の更新と同じDB transactionで増やす。
TrustSnapshotはinputVersionとruleIdの両方が一致する場合だけ使う。
MutationReceiptのunique(actorId,operation,key)、payloadHash、status、operationId、確定resultを保持。
同key異payloadはCONFLICT。同key同payloadで確定済みならresultを返し、処理中なら同operationIdを返す。
同時claimはDB一意制約で1つだけ成功。確定結果は業務更新と同時保存。
処理中の回復はDBの排他ロック/リースで1workerに限定する。
成功receiptは対象が存在する期間保持し、記録削除後は最小の削除済みtombstoneにして再作成を防ぐ。

## Sources

[Git commit-tree](https://git-scm.com/docs/git-commit-tree)、
[Git update-ref](https://git-scm.com/docs/git-update-ref)。
Gitは内容と履歴を扱い、音楽上の妥当性とサービスの権限はs-core/DB側で検証する。

## Recoverable operation record

処理開始時にactorId、operation、key、payloadHash、operationId、repositoryId、
scoreId（新規作成時は予約済みID）、proposalId（必要時）、expectedRepositoryOid、expectedRevisionIdを保存する。
object準備後はpreparedCommitOid、固定preparedRef、stage=OBJECT_PREPARED、更新日時を記録する。
元ファイル・候補JSONをreceiptへ保存しない。回復は準備コミットの検証済みtreeから行う。
preparedRef書込とDB記録の間で停止した場合も、operationIdの固定refから回収できる。
objectがないCLAIMEDは自動で採用せず、利用者再送を待つか期限付き取消にする。
回復workerはleaseOwner/leaseUntilとDB排他取得で同じ操作を一度だけ進める。
DB確定前は操作者の現在権限・信頼度・基準OIDを再確認し、不一致なら採用しない。
DB確定後はその採用結果を維持して同期だけを行う。

共通基盤の採用エンジンは操作種別別の認可/DB反映を持つ。移行・初版割当は運営専用、
編集案採用はUS2で接続する信頼度/メンバー判定を使用する。移行に編集案モデルへの依存を持たせない。

## Consistent backup checkpoint

1. サービス全体のmaintenance gateを有効化し、全DB書込とGit変更（採用・提案・準備・ref同期・GC）を止める。
   進行中の要求は完了させるか回復可能なstageへ止め、workerとGCの停止を確認する。
   読取は継続可能。新しい書込は一時利用不可と再試行案内を返す。
2. gateを維持したままcheckpointIdとDB状態を記録し、transaction-consistentなDBスナップショットを取得する。
3. 同じgateの下で全bare Git保存領域を取得し、objectFormat、各repo採用OID/世代、準備ref、
   DBスナップショットの識別子とともにmanifestへ記録する。アーカイブのハッシュを付ける。
4. DBの採用版・提案・練習参照・準備操作が指す全OIDとblobハッシュをGitバックアップで照合する。
   失敗した組は有効バックアップとせず、gateを維持して再取得または運営判断で中止する。
5. 検証済みの組を確定後、gateを解除して回復worker→新規書込→GCの順に再開する。

復旧は書込停止の専用領域へDB/Gitの同じcheckpointIdを戻し、manifest・ハッシュ・全参照OIDを照合。
DB_APPLIEDの未同期jobを回復し、準備中操作を検査してから書込を開放する。
本番データへの復元は別途の運用操作として扱い、設計・テスト時に実施しない。
