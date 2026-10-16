# メール認証の切替・復元と運用

アプリの認証実装と自動試験は、実配送・実OAuthの受け入れとは別に扱う。現時点の未確認項目は[検証記録](../specs/002-email-password-login/validation.md)を参照する。

## 初回切替

1. 全レプリカの入口をメンテナンス表示へ切り替え、認証・通知・cleanup workerを停止する。DBとSCORE_GIT_ROOTを同じ復元点で保全する。全レプリカが共通のmaintenance gateを参照することを確認する。
2. 追加migrationを適用し、既存メール索引をbackfillする。正規化衝突は自動統合せず、匿名User IDの報告を確認する。User/Account/役割・楽譜所有・履歴・信頼度の件数と識別子を前後比較する。
3. 全レプリカを標準JWT＋sid照合の同じ版に揃え、旧版を再起動させない。認証secretは秘密管理基盤で配布し、ログやチャットに貼らない。
4. 次の失効コマンドを実行する。コマンド自身が共通maintenance gateを作り、進行中leaseを待ち、旧Sessionを削除、全User世代を増加、sid/案内/proofを失効させる。User/Account/資格情報/楽譜/履歴は削除しない。失敗時はgateを残すため、原因を確認せず手動解除しない。

```bash
node --conditions=react-server --import tsx scripts/revoke-legacy-auth-sessions.ts
```

5. このコマンドの成功で一時gateは解除される。外側のメンテナンス表示とworker停止は、全レプリカの配布・設定確認・動作確認が済むまで維持する。利用者には通常の再ログインを案内する。
6. メール開放前に専用テスト宛先でSMTP/TLS実配送と登録→確認→login→reset/changeを確認する。GitHubは登録済みの検証用OAuthアプリでT055を完了してから有効化する。

## 停止・rollback・backup復元

- メール障害ではEMAIL_PASSWORD_ENABLED=falseへ変更して全レプリカを再起動する。GitHubの必須設定は維持できる。設定のないGitHub専用Userにメール資格情報を自動付与しない。
- GitHub設定はID/secretの両方を追加・除去して再起動する。User/Account/credentialを削除しない。通常session/logoutは引き続きsidを照合する。
- rollbackでも旧DB Sessionを復活させない。旧cookieを受理する旧版へ戻すことを復旧手段としない。必要なら入口を閉じたまま修正版を配布する。
- backup復元前に入口と全workerを停止する。DB/Gitの復元後、新しいAUTH_SECRETを生成・配布し、AUTH_SECRET_1/2/3等の旧鍵fallbackも除去する。全レプリカを同じ新鍵に揃え、上の失効コマンドを再実行してから開放する。secret更新だけでDBの案内/proof失効を代用しない。
- 復元前のcookie・旧Session・案内が拒否されること、同じUser/役割/所有/履歴が維持されることを確認する。本番切替・復元を自動回帰から実行しない。

## 定期処理と保持

```bash
node --conditions=react-server --import tsx scripts/cleanup-authentication.ts
node --conditions=react-server --import tsx scripts/deliver-auth-notices.ts
```

両方ともSCORE_GIT_ROOTのwrite leaseを取得し、メンテナンス中は処理しない。通知は秘密なしの変更通知だけをat-least-onceで送る。配送先・資格情報は環境で管理する。

cleanupはDB時刻を使い、案内/proofは失効・消費・期限から7日、sidは失効・期限から7日、attempt/windowは期間終了から24時間、変更イベントと通知は90日で回収する。有効な案内を持つPENDING Identityを消さず、発行処理と同じIdentity lockで再確認する。1回に最大500件の不要なPENDING Identityを回収する。bound Identity・User・Account・作成receiptは利用者削除まで維持する。
