# Development

Use Node.js 22 and a dedicated PostgreSQL database. Never run test migrations against production.
Environment variables: DATABASE_URL, AUTH_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET,
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
AUTH_GITHUB_ID=<oauth-client-id>
AUTH_GITHUB_SECRET=<oauth-client-secret>
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
