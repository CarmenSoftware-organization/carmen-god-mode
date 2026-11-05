# Changelog

รูปแบบตาม [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) และเลขเวอร์ชันตาม
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) วันที่เป็น UTC

รายการเขียนด้วยมือ — `bun run build:bump` เขียนร่างจาก commit ไว้ใน `[Unreleased]` แล้วหยุดให้แก้
ก่อน จากนั้นรอบถัดไปจึงย้ายรายการที่แก้แล้วลงหัวข้อเวอร์ชันพร้อมตัดรุ่น รายการของรุ่นก่อน v0.4.0
คัดมาจาก GitHub Releases ที่เขียนไว้ตอนนั้น

## [Unreleased]

## [0.4.2] — 2026-11-05

A security pass over the SQL console and the write endpoints, a batch-delete fix, and the
`PLATFORM` → `BACKSTAGE` rename.

### Changed

**`PLATFORM_PACKAGE_DIR` is now `BACKSTAGE_PACKAGE_DIR`, with no fallback** (581812d, eef95bf, b5fbb57)
Rename the variable in every env file before upgrading. Without it the `/platform-migrations` page
cannot find the package. The default package path is now `prisma-shared-schema-backstage`, catalog
commands are `db:seed.backstage-*` / `db:check.backstage-*` (registry ids are unchanged), and the
gateway permission check calls `GET /api/user/permission/backstage` instead of `/platform`.

### Fixed

**Batch delete of ~100+ rows failed with 431** (#41)
The Delete / Hard delete button put every selected primary key in the URL. Next.js repeats the URL in
its navigation headers, so around 100 UUIDs the request went over Node's 16KB header limit. The
selection now goes into the tab's sessionStorage and the confirm page fetches the blast radius through
a server action. This applies to clusters, business units and the generic row grid.

**The SQL console can no longer be used to write or to take the database down** (#38)
Each run executes exactly one statement, and the read path runs inside a `READ ONLY` transaction.
Statements are checked against an allowlist and a side-effect denylist that matches both the raw and
the comment-stripped text, so comments and parentheses no longer hide a write. The denylist includes
functions such as `pg_terminate_backend` and `pg_drop_replication_slot`. `EXPLAIN ANALYZE` (and
`ANALYSE`) is refused, because it executes the statement it explains.

**Write endpoints validate their input** (#38)
`valuesFromForm` is no longer exported as a public server action. A row's `pkJson` must name exactly
the table's primary-key columns, so a tampered key cannot match many rows. `app/api/ops/*` answers
malformed bodies and wrong field types with 400 instead of 500.

**Deploy health check** (#35)
It now probes Next.js directly at `127.0.0.1:$PORT`, not nginx on `:9903`, which answered 301.

**Migrations catalog drift** (#37)
Added the `seed/check application-api` ops, recorded why 4 scripts stay hidden, and removed the stale
`db:backfill.subscription`. `seed-report-template-upload` and `db:backfill.bu-license` are gone
because backend #927 deleted those scripts.

### Internal

- A security test suite pins the middleware gate, session-cookie hardening, and a drift guard that
  requires every server action to call `requireAuth` first.
- `.trail/` holds trail's index config and the learnings shared between sessions. Its generated
  files are excluded from lint, so `bun run lint` is clean again (#42).
- Tests: 450 (one, `platform-catalog-drift`, depends on the local backstage package checkout).

## [0.4.1] — 2026-08-30

### Added

- send audited god-mode operations to SigNoz (a0e1908)

### Fixed

- surface db:seed.license-feature in the migrations catalog (#26)
- surface db:check.seat-pool-view in the migrations catalog (#28) (dca78ff)

## [0.4.0] — 2026-08-18

This file, and a release script that refuses to tag without it.

### Added

**A changelog the release script drafts but does not write** (#25)
`bun run build:bump` now reads `[Unreleased]` before anything else. Finding it empty, it fills the
section with a draft built from the commits since the last tag and stops — those lines are commit
subjects, and the notes here are prose. Rewrite them and run the same command again: the second pass
moves them under a dated version heading. The draft walks `--first-parent`, so a merged PR is a
single step and every entry it contributes cites that PR number rather than a commit hash;
housekeeping types (`chore`, `docs`, `test`, `ci`, `build`, `style`) are left out and counted.

**Release commits carry their own notes** (#25)
The changelog entry, the version bump, the commit and the tag are one step, so a tag never points at
a commit whose notes arrive later. This meant taking the commit away from `bun pm version`, which is
now run with `--no-git-tag-version`: it refuses to run at all while `CHANGELOG.md` holds the edited
draft, since even a staged file counts as an unclean tree. For the same reason `CHANGELOG.md` is the
one file the tree guard tolerates as dirty — requiring a commit for it first would put a changelog
commit on `main` outside a pull request, which the repo's own rule forbids.

### Internal

- Notes for v0.3.1, v0.3.0 and v0.2.0 are backfilled from their GitHub Releases.
- Tests: 247 → 272.

## [0.3.1] — 2026-08-18

### Internal

- The release commit is carved out of the PR-only rule (#24): `bun run build:bump` commits and tags
  on `main` and is pushed directly, because routing it through a PR would leave the tag pointing at
  the branch commit rather than at anything on `main`.

## [0.3.0] — 2026-08-18

Every god-mode page that reads the business-unit registry was crashing. Fixing that surfaced a
second, quieter problem: the tool could drop a schema on the wrong database entirely.

### Fixed

**Registry pages crashed with `column "db_connection" does not exist`** (#17)
The upstream platform schema removed `tb_business_unit.db_connection` (jsonb) and split it into
`db_schema` plus `database_pool_id` → `tb_database_pool`. Every registry query still asked for the
old column. The integration fixtures created the table themselves with the old shape, which is why
the suite stayed green while the live database had moved on.

**An abandoned migration wedged `/platform-migrations`** (#23)
Closing the tab mid-run left the page answering "A platform migration is already running" to
everyone until the server restarted, with no subprocess alive. Enqueueing on the cancelled response
stream threw, that throw reached `runProcess`'s close handler before `resolve()` on the same line,
and the promise never settled — so the lock's `finally` never ran.

### Added

**Tenant drops are checked against the registry's database pool** (#19, closes #18)
god-mode holds one connection and resolved tenant schemas by name alone, so a business unit moved to
a different pool would have had its `DROP SCHEMA` executed against whatever schema of that name
existed on the connected host — no error, just a wrong target. Drops now compare host, port and
database against `DATABASE_URL` and refuse a mismatch. Hostnames are compared literally: guessing
that two names are one host is the assumption the check exists to remove. The mismatch is surfaced
in the business units table and on the delete page, so it reads before the destructive step rather
than as a 409 at confirm time.

**`db:check.api-system-permission` in the platform migrations catalog** (#17)
A new upstream script that the reverse drift test had been flagging as unwired.

### Internal

- The e2e suite is green for the first time (#21, #22): one shared login helper instead of two
  copies that drifted apart, locators updated for `role="tab"` and the press-and-hold confirm, and
  a success assertion that no longer matches the subprocess log and fails a run that exited 0.
- Every change now reaches `main` through a pull request (#20).
- Tests: 227 → 247.

## [0.2.0] — 2026-08-05

The first tagged release: 234 commits from 2026-06-25 to 2026-08-05, covering everything the tool
did before versioning began. Notes reconstructed from the commit history.

Carmen Inventory God Mode is an admin console over a **live** Postgres. Every write is permanent, so
most of what follows is machinery for making destructive work legible before it happens.

### Browsing and editing

- Registry home, schema banner, protected app shell, table list
- Generic row grid with keyset pagination, multi-select, and "Delete N selected"
- Insert and edit forms with type coercion
- Runtime catalog introspection (schemas, tables, columns, foreign keys)
- Raw SQL console with preview/commit and an indeterminate running bar
- postgres.js client and transaction helper, typed env config via zod

### Destructive operations

- FK-graph cascade **blast radius** and executor, with topological table ordering, deterministic FK
  listing, refusal on FK cycles, and caps that refuse rather than truncate
- `computeBlastRadiusMany` / `executeCascadeMany` — all-or-nothing batch cascade
- Type-to-confirm delete preview; the phrase becomes the schema name when a tenant schema is dropped
- Cluster hard delete with multi-schema drop; reusable soft-delete/restore with audit
- Identifier guard and statement classifier so dynamic SQL cannot be assembled unquoted
- Danger-zone operations gated behind `ALLOW_DANGER_OPS`, in both the page and the API

### Streaming progress

`streamOperation` emits NDJSON; the client reads it through `useOperationStream` + `OperationProgress`.
Long operations report through an optional `onProgress`, and the cascade engine emits events as it
works. Delete moved off server actions onto this streaming route.

### Platform migrations

A `/platform-migrations` page that runs the platform package's own scripts as subprocesses, with a
catalog of operations, a schema selector that injects the chosen schema into the subprocess URLs,
schema-name validation, a bootstrap gate for new schemas, a concurrent-run lock, and per-run audit.

### Auth and audit

- Shared-secret auth with iron-session and a route guard; gateway auth against the backend API
- Audit log storage with its own migration, write paths that self-ensure the audit table, and schema
  bootstrap recorded as its own `CREATE_SCHEMA` action
- Audit viewer with keyset pagination and change diffs opened in a Sheet

### Tooling

`bun run build:bump` — cuts a release locally: bumps `package.json`, commits `chore(release): vX.Y.Z`,
and creates an annotated tag. It never pushes, runs only on a clean `main` that is not behind its
upstream, and gates on typecheck and lint. This tag is its first use.

Also `dev:uat` for a third environment file, and a fix to skip lifecycle scripts on Vercel install.
