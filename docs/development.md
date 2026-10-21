# Development

Use Node.js 22 and a dedicated PostgreSQL database. Never run test migrations against production.
Environment variables: DATABASE_URL, AUTH_SECRET, EMAIL_SERVER, EMAIL_FROM, optional AUTH_GITHUB_ID/AUTH_GITHUB_SECRET,
IMPORT_PREVIEW_SECRET, SCORE_GIT_ROOT (absolute persistent directory), TEST_DATABASE_URL.
Do not commit secrets. Git score storage is separate from this application's checkout.

Run `npm ci`, `npx prisma generate`, `npm test -- --run`.
Integration tests require TEST_DATABASE_URL pointing to a database whose name ends in `_test`.
Run `npm run test:integration`. The integration harness refuses all other databases.
Configure the GitHub OAuth callback `/api/auth/callback/github` for your development origin.

Git CLI is required on the server (the Dev Container provides the Git feature).
Mount a persistent directory outside the application checkout as SCORE_GIT_ROOT;
its contents must survive application replacement. Restrict it to the service user.
Example names (replace placeholders locally; do not commit actual values):

```dotenv
DATABASE_URL=postgresql://user:password@localhost:5432/hakei
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/hakei_test
AUTH_SECRET=<random-secret>
EMAIL_SERVER=smtp://localhost:1025
EMAIL_FROM=sender@example.invalid
# AUTH_GITHUB_ID=<oauth-client-id>
# AUTH_GITHUB_SECRET=<oauth-client-secret>
IMPORT_PREVIEW_SECRET=<independent-random-secret>
SCORE_GIT_ROOT=/var/lib/hakei/scores
```

Run recovery with `node --conditions=react-server --import tsx scripts/recover-git-publications.ts`.
Grant the first operator only through the local command:
`npx tsx scripts/grant-operator.ts <existing-user-id> "<audit reason>"`.
Public requests cannot grant the service role. Recovery logs operation IDs/status, not score content.

The score-import worker is bundled by `npm run build:import-worker` into
`dist/import-worker.mjs`. `dev`, `build`, and integration tests build it automatically.
Include this generated artifact alongside `.next` in production; `next start` does
not run a TypeScript loader. Rebuild it after changing a converter.

MusicXML import accepts declared versions 2.0, 3.0, 3.1 and 4.0 in score-partwise XML/MXL.
The preview shows the actual source version; the same version is signed and retained in Git/DB.
Unsupported structures or unknown/unsupported versions have distinct 415 explanations.
A missing root version is recovered only from a matching standard Recordare PUBLIC DOCTYPE
that explicitly names a supported version; an INFO diagnostic records its origin.
No version is inferred from a common SYSTEM URL, and conflicting declarations are rejected.
Invalid settings (for example tempo zero) are rejected; valid but uninterpretable instructions
or conflicting part settings remain blocking. Existing defaults for omitted settings are warnings.
Source-dependent blockers cannot be cleared by acknowledging a warning.
See [the compatibility matrix](../specs/007-musicxml-version-compat/contracts/compatibility-matrix.md)
and [validation, including the original Menuett check](../specs/007-musicxml-version-compat/validation.md).

Import defaults are 5MiB input, 20MiB expanded ZIP / 100 entries, 10,000 notes,
10 seconds per conversion, one request per user, and four workers in total.
`IMPORT_MAX_INPUT_BYTES` / `IMPORT_TIMEOUT_MS` can lower their respective defaults.
`IMPORT_MAX_CONCURRENT_WORKERS` accepts 1–16; choose a value for the deployment's
memory budget (128MiB worker heap plus byte buffers per active worker).
Admission is coordinated in PostgreSQL, including across server instances;
uploads renew their fenced lease before starting conversion. Body reading has
its own 10-second deadline. Only actor/lease metadata enters this table.
Use an independent `IMPORT_PREVIEW_SECRET` of at least 32 bytes. Preview and
revalidation endpoints require the browser's same-origin POST; previews expire
30 minutes after initial conversion and correction does not extend that expiry.

All saved revisions include `score.json`, `settings.json` (conversion metadata
and acknowledged issue IDs), `diagnostics.json`, and `validation.json` in Git.
DB validation/issue rows are projections with cascading revision foreign keys.
An unresolved blocking issue remains after warning acknowledgement and through
ordinary editing/merge. Actual missing-field corrections produce a newly
validated revision; the original revision keeps its restriction. Unverifiable
source-dependent issues require a corrected source re-import through a proposal.

## Recording rules and personal history

After deploying migrations, run `npx prisma db seed` with DATABASE_URL and SCORE_GIT_ROOT configured.
The seed runs in the Node server condition and only initializes immutable evaluation rule version 1.
It does not grant operators or activate trust thresholds. For disposable demo music only,
`node --conditions=react-server --import tsx prisma/seed.ts --demo` explicitly adds random data.

Open a saved playable revision, choose practice or rhythm game, allow Web MIDI, select one input,
and choose track, inclusive bar range, tempo ratio and signed input-delay correction.
Positive calibration is subtracted from input timestamps. Match windows include their endpoints.
Rules are 150ms for practice and 60ms / 30ms for game good/perfect; score is stored before display rounding.
The same immutable revision, conditions and rule are used on the server when saving.
The app keeps failed saves in memory with the original clientSessionId; retry before leaving the page.
It does not put performances in localStorage/IndexedDB. Logout, unmount and pagehide release MIDI/audio and memory.

History is at `/practice/history`. Access revocation hides the score body while retaining the owner's
result summary. Deleting a performance removes its input batches and evaluation and recomputes
completion counts, condition-specific bests and achievements in the same transaction.

## Consistent DB/Git backups

All replicas and recovery commands must use the same POSIX filesystem in SCORE_GIT_ROOT.
The atomic directory gate and admission leases also cover authentication adapter writes and import routes.
Run all maintenance CLIs with `node --conditions=react-server --import tsx`; this also applies to
`grant-operator.ts` and `migrate-legacy-scores.ts` now that they participate in write admission.
Direct SQL, Prisma migration commands and other external writers must be stopped by the operator
while taking a checkpoint; they cannot be controlled by an application filesystem gate.

Install PostgreSQL's `pg_dump` and `pg_restore`. Local validation uses server/client 18; CI uses 16.
Backups contain private scores, performances and authentication tables. Store the destination on a
restricted volume; the command creates a new directory with mode 0700 and never overwrites a backup.

```bash
node --conditions=react-server --import tsx scripts/backup-score-git.ts /protected/backups/new-checkpoint
node --conditions=react-server --import tsx scripts/verify-score-git.ts /protected/backups/new-checkpoint
```

The backup command atomically creates `.maintenance`, rejects new writes and waits for `.write-leases`
to drain. It verifies all indexed revisions and blobs, proposals, prepared operations, publication jobs
and unrecorded preparation refs, creates conservative retention refs, performs GC under the freeze,
and obtains one PostgreSQL custom dump plus the corresponding bare repositories.
`manifest.json` records the same checkpointId as the gate, SHA-1 object format, accepted OIDs/generations,
all refs and protected OIDs, revision blob hashes and SHA-256 hashes of the dump and every copied Git file.
It verifies the copied Git against DB indices and the manifest before releasing the gate.
All indexed historical revisions are retained, including practice references. Retention refs are not
silently expired; operator-directed retention changes are a separate procedure.

A failed or interrupted backup deliberately leaves `.maintenance` in place. A crashed writer can leave
an admission lease, which is never guessed to be expired. Stop all application replicas, import jobs,
recovery jobs and external writers; inspect checkpoint.json, active leases and pending operation stages.
After deciding to abort the failed checkpoint, remove only that gate and the confirmed dead leases.
Restart recovery before opening new writes. Do not delete a gate held by a running backup process.

Restore into a new isolated PostgreSQL database and Git directory, never over a running production store.
Use the same checkpoint's database.dump and `git/` directory. Set DATABASE_URL to the restored database:

```bash
# Create an empty isolated DB first; pg_restore must target that DB explicitly.
pg_restore --no-owner --exit-on-error --dbname=<isolated-restored-db> /protected/backups/checkpoint/database.dump
node --conditions=react-server --import tsx scripts/verify-score-git.ts /protected/backups/checkpoint --restored-db
```

Verify all hashes and indexed OIDs before running recovery with SCORE_GIT_ROOT set to the restored `git/`.
Recover DB_APPLIED jobs and inspect unfinished preparations before enabling writes or any later GC.
Integration tests create and destroy a new `_test` database to prove dump restoration and Git matching;
the test role therefore needs CREATEDB permission. Existing production databases are never restored by tests.

## Reproducible measurements

`node --conditions=react-server --import tsx scripts/benchmark-score-practice.ts` requires a dedicated
TEST_DATABASE_URL ending in `_test`; it creates temporary repositories and records and cleans them up.
It measures 30 runs of 10,000 expected notes / 50,000 inputs, a 50-row private history page and a
678-byte one-note MusicXML conversion, and checks the 5MiB input limit. Output includes p95, maxima,
CPU availability and the process high-water RSS. The small conversion sample does not establish
worst-case conversion throughput or the combined memory of concurrent workers.

Standard email-link authentication, migration and configuration are documented in
[email-auth.md](email-auth.md). Local SDK/delivery fixtures do not replace delivery or real OAuth acceptance.

## Local Mailpit

Dev Container uses node:22-bookworm and the [Mailpit Feature](https://github.com/skriptfabrik/devcontainer-features/blob/main/src/mailpit/README.md), pinned to Mailpit 1.31.6. The Feature requires Debian and starts Mailpit through its own entrypoint; no Dockerfile or Compose sidecar is needed. Rebuild with VS Code **Dev Containers: Rebuild Container**.

Open the private forwarded app port at http://localhost:3000 and Mailpit at http://localhost:8025. SMTP is available inside the container at localhost:1025. Do not publish the Mailpit UI or configure external relay/forwarding. The Feature stores captured messages in its managed /var/lib/mailpit volume; messages can survive container recreation.

containerEnv supplies EMAIL_SERVER=smtp://localhost:1025 and EMAIL_FROM=hakei@example.invalid for development. Next.js uses the process environment before .env/.env.local; existing secret files are not modified. Do not use these development settings in production.

Run npm ci, npx prisma generate, and npm run dev after configuring the existing dedicated development DB, AUTH_SECRET and SCORE_GIT_ROOT. Visit /api/auth/signin, request a link for person@example.invalid, open it from Mailpit, visit a protected screen and log out. The callback must use the browser-reachable app origin, never the internal service name. If using a remote forward, use the reachable origin consistently and keep forwarding private.

For failure/recovery checks, use the Feature's PID file inside the container:

```bash
start-stop-daemon --stop --pidfile /var/run/mailpit.pid
/usr/local/share/mailpit-init.sh true
```

With Mailpit stopped, requests must fail without authenticating; after restarting, request a fresh link. Recreate the container and repeat the flow.

### Integration SMTP prerequisites

Use a dedicated Mailpit instance and dedicated _test DB. Tests must not share a production or personal inbox. Start Mailpit before tests and confirm its API responds:

```bash
# In a separate terminal, reserve a fresh directory for this test instance:
# mailpit --database /tmp/hakei-integration-mailpit/mailpit.db --listen 127.0.0.1:18025 --smtp 127.0.0.1:11025 --disable-version-check
# Create the directory first and stop this instance when testing is finished.
export TEST_EMAIL_SERVER=smtp://127.0.0.1:11025
export TEST_MAILPIT_URL=http://127.0.0.1:18025
node -e 'fetch(process.env.TEST_MAILPIT_URL + "/api/v1/messages").then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))'
# Set TEST_DATABASE_URL separately to the dedicated _test database
npm run test:integration
```

Use the installed local Mailpit binary for the dedicated instance above; do not point automated tests at the developer inbox on 1025/8025. Use the same fixed release; do not add a custom SMTP server. The integration test removes its captured messages. Browser, Dev Container rebuild, production TLS delivery and real GitHub OAuth remain separate acceptance checks.

CI prepares a dedicated Mailpit 1.31.6 binary in the runner temporary directory, verifies the release archive SHA-256, binds SMTP/API to loopback ports 11025/18025, and waits for the API before integration tests. These test endpoints are separate from the developer inbox on 1025/8025. Changing the Mailpit release requires updating and rechecking the checksum in `.github/workflows/test.yml`.

### Production build inside the development container

The development container supplies plain localhost SMTP, which production configuration deliberately rejects. For a build that does not require email delivery, disable the email provider only for that command:

```bash
EMAIL_SERVER= EMAIL_FROM= npm run build
```

This does not edit `.env` or change the running development server. A production runtime that needs email login must supply its own authenticated TLS SMTP settings described in [email-auth.md](email-auth.md). Do not relax the production SMTP checks to reuse Mailpit.

### GitHub environment variable names

This project uses next-auth 5.0.0-beta.32. Follow the [Auth.js v5 GitHub guide](https://authjs.dev/getting-started/providers/github): AUTH_GITHUB_ID and AUTH_GITHUB_SECRET. Both must be configured to enable GitHub login. The [NextAuth.js v4 example](https://next-auth.js.org/providers/github) uses GITHUB_ID/GITHUB_SECRET and passes them explicitly; that example targets a different major version.

## Notation fixtures

Open `/dev/notation/fixtures` in development to inspect individual symbols and their expected conditions. The route returns not-found in production; existing Core/MXL galleries remain available in development.

Add fixtures to `src/s-core/fixtures/notation/manifest.json` with one primary condition, stable IDs, source provenance, layout, expectedOutcome and requiredStages. Keep inputs small; document sizeReason when a system/page boundary requires a larger input. Add assertions and destructive counterexamples with each symbol change. A rendered SVG alone is not a verification pass.

Run `node --import tsx scripts/verify-notation-fixtures.ts` to write automatic results to `specs/008-extend-score-notation/verification-results.json`. Use `--persisted` only with a dedicated TEST_DATABASE_URL ending `_test`; it exercises actual save/read/proposal/merge paths. Regular npm test does not overwrite reports. Missing database or visual checks stay unverified.

Record actual browser reviews in `visual-results.json` according to [the fixture contract](../specs/008-extend-score-notation/contracts/fixtures.md). Include current input/expectation hashes, rendererRevision, layout, browser, reviewer, time and each visual checklist ID. The loader rejects stale evidence after code/font/input/expectation/layout changes. It never creates visual passes from SVG structure tests.


### TAB・ドラム譜のfixtures

`src/s-core/fixtures/tab-drum/manifest.json` は `tab/`・`drums/`・`mixed/`・`reject/` の自作最小入力を参照する。1つのfixtureにつき主条件を1つ定め、数字・弦・符頭・位置・符幹・旗・連桁などの期待値と、その誤りを検出する対照結果を加える。改行・改ページに必要な入力は固定layoutとsizeReasonを記録する。既存IDは維持する。

`node --import tsx scripts/verify-notation-fixtures.ts --suite tab-drum` で009へ、`--suite notation`（省略時の既定）で008へ自動結果を保存する。両方を `/dev/notation/fixtures` で確認できる。通常の `npm test` は証跡ファイルを更新しない。

`render` は保持・モデル往復・実保存取得・Document・SVG・実ブラウザーの6段階、`partial` は既知情報と元表記・診断のimport/roundtrip/persisted、`reject` は期待する拒否と保存不変の適用段階を検証する。partialの描画非適用を描画合格と扱わない。

打楽器の打音は表示位置と楽器対応を保持する。打楽器休符は `rest:true, pitch:null` と所属譜表を持ち、打音用表記を要求しない。旧数値pitch付き休符は読み続ける。TABの運指を音高から生成せず、ドラム・音高不明TAB・対応不明の通常譜併記は理由付きで演奏不可とする。

目視結果は該当suiteの `visual-results.json` に、visualChecklist ID、確認した入力・期待値・layout・rendererRevision、日時、ブラウザー、確認者を記録する。最新ソース・フォントで失効した条件は再確認する。SVG生成やjsdomの合格は実表示の合格を代替しない。DB検証は今回利用者指示で保留し、後日末尾 `_test` の専用DBで `--persisted` を実行する。
