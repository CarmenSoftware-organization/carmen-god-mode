# Security test suite for every entry point (and fix what it finds)

**Date:** 2026-11-03
**Status:** Approved

## Intent

God-mode is an admin tool over a live Postgres where every write is permanent.
There is no incident driving this — the operator wants security tests in place
*before* a vulnerability causes damage, and wants any vulnerability the tests
expose fixed in the same piece of work (not just recorded).

"All" means **every way a request can reach the system** — API routes, server
actions, and the middleware — not a unit test for every file in `lib/`. Files
that already have security coverage are not re-tested.

## Goals

1. **Auth on every entry point.** Every callable entry point rejects an
   unauthenticated caller before touching the DB.
2. **Hostile input.** Entry points reject malformed / hostile input (odd
   identifiers, tampered `pkJson`, malformed request bodies) without executing
   anything.
3. **SQL console limited to table data.** The console can read and modify rows
   in tables; no write can commit through the read path (every committed write
   goes through `applySql`, which audits), and it cannot call system-level
   side-effect functions. *(Claude's call: preview stays a UI step — the server
   does not verify that `applySql` was preceded by a preview. Enforcing that
   would need server-side preview tokens; out of scope.)* (Operator's decision:
   they never use the console for system functions — "only table data".)
4. **Drift guard.** A new server action added later without `requireAuth()`
   fails the test suite automatically.

## Non-goals

- Full unit coverage of `lib/` or a coverage percentage target.
- Re-testing what is already covered: the three `app/api/ops/*` routes already
  have unauth + wrong-confirm-phrase tests; `ident()`/`qualified()`; both login
  methods (`lib/__tests__/auth-gateway.test.ts`, `session.test.ts`).
- A true SQL sandbox (a restricted DB role with no privileges). The console
  guard protects against **mistakes and the blast radius of a stolen session**,
  not against a malicious authenticated super-admin, who can write anything
  through the grid anyway. A denylist is acceptable at that threat level.
- Rate limiting, CSRF beyond Next.js's built-in server-action origin check,
  dependency scanning.

## Anti-goals

- Any test touching the live DB from `.env.local`. All SQL-behaviour tests run
  on embedded Postgres (`.int.test.ts`, `@/test/pg` `startPg()`).
- Breaking legitimate console use: plain `SELECT`, `WITH … SELECT`, `EXPLAIN`,
  and single `INSERT`/`UPDATE`/`DELETE` and DDL with preview → apply must keep
  working.

## Current state (recon, 2026-11-03)

Entry points:

| Entry point | Auth today | Tested today |
|---|---|---|
| `app/api/ops/cascade-delete/route.ts` | `requireAuth` + phrase | yes |
| `app/api/ops/drop-schema/route.ts` | `requireAuth` + phrase | yes |
| `app/api/ops/platform-migrate/route.ts` | `requireAuth` + phrase + danger gate | yes |
| `server/auth.ts` `login`, `gatewayLogin` | n/a (they *are* auth) | yes |
| `server/auth.ts` `logout` | none needed | no |
| `server/sql.ts` `runSql`, `applySql` | `requireAuth` | **no** |
| `server/rows.ts` `submitInsert`, `submitUpdate` | `requireAuth` | **no** |
| `server/rows.ts` `valuesFromForm` | **none** | **no** |
| `server/cluster-actions.ts` (4 actions) | `requireAuth` | **no** |
| `middleware.ts` | is the gate | **no** |

### Vulnerability 1 — SQL console read path commits writes, unaudited

`lib/sql-guard.ts` `classifyStatement` looks only at the **leading keyword**.
A statement classified `read` goes to `lib/sql-runner.ts` `runRead`, which runs
it in an ordinary read-write transaction (`lib/db.ts` `withTransaction`) that
commits — no preview, no audit row.

Confirmed: `tx.unsafe(statement)` with no params uses the **simple** protocol
(`node_modules/postgres/src/index.js:124`, `simple: args.length === 0`), so
multiple statements run. Therefore via `runSql`:

- `SELECT 1; DELETE FROM t` — deletes, committed, unaudited.
- `SELECT 1; COMMIT; DELETE FROM t` — ends the wrapping transaction early.
- `SELECT * INTO new_t FROM t`, `SELECT setval(...)` — single statements that
  write.
- `SELECT pg_terminate_backend(...)` — kills other sessions; also not undone by
  the write path's preview rollback (it executes during preview).

### Vulnerability 2 — `valuesFromForm` is an unauthenticated server action

`server/rows.ts` exports `valuesFromForm` from a `"use server"` file, so Next.js
exposes it as a callable endpoint. It has no `requireAuth()` and calls
`describeTable(schema, table)` — an unauthenticated caller can introspect any
table's columns. It is used internally by `server/rows.ts` and
`server/cluster-actions.ts`.

## Design — decided parts

### Fix 1: SQL console

- **One statement only.** Run console statements over the **extended** protocol
  (`tx.unsafe(statement, [], { simple: false })` or equivalent), so Postgres
  itself rejects multi-statement input. This removes the `; DELETE` and
  `; COMMIT` attacks without hand-parsing semicolons (strings, comments,
  dollar-quotes make that fragile).
- **Read path is read-only.** `runRead` runs in a `READ ONLY` transaction, so a
  write that slips past classification (`SELECT INTO`, `setval`, a function
  that writes) is rejected by Postgres.
- **Allowlist of statement kinds.** Read: `SELECT`, `WITH` (non-modifying),
  `TABLE`, `VALUES`, `EXPLAIN` (without `ANALYZE`), `SHOW`. Write: `INSERT`,
  `UPDATE`, `DELETE`, `MERGE`, `WITH` containing those, **and DDL**:
  `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `GRANT`, `REVOKE`, `COMMENT` — these
  keep working exactly as today (preview in a rolled-back transaction, then
  apply + audit). *(Operator's decision, 2026-11-03.)* Everything else is
  rejected with a clear error before execution — including transaction control
  (`BEGIN`/`COMMIT`/`ROLLBACK`/`SAVEPOINT`/…), `COPY` (incl. `PROGRAM`),
  `SET`/`RESET`/`DISCARD` (session-level `SET` would also pollute a pooled
  connection), `DO`, `CALL`, `LISTEN`/`NOTIFY`.
- **Side-effect function denylist**, applied to both paths, case-insensitive,
  matching with or without a `pg_catalog.` prefix or double quotes:
  `pg_terminate_backend`, `pg_cancel_backend`, `pg_reload_conf`,
  `pg_rotate_logfile`, `pg_promote`, `pg_read_file`, `pg_read_binary_file`,
  `pg_ls_dir`, `pg_stat_file`, `lo_import`, `lo_export`, `lo_unlink`,
  `dblink*`, `set_config`, `pg_advisory_*lock*`, `pg_sleep*`. Documented in code
  as a mistake guard, not a sandbox (see non-goals).
- Rejections throw an `Error` with a user-readable message; the console UI
  already surfaces thrown errors (builder: confirm in `components/sql-console.tsx`).

### Fix 2: `valuesFromForm`

Move it out of the `"use server"` file into `lib/` (e.g. `lib/form-values.ts`)
so it is no longer an endpoint; update both callers. No behaviour change.

### Tests

Conventions from CLAUDE.md apply (`.test.ts` node, `.int.test.ts` embedded PG,
mock `@/lib/session` + `next/cache`; also mock `next/navigation` `redirect` for
row actions).

1. **Auth per server action** (`.test.ts`): for each action in `server/sql.ts`,
   `server/rows.ts`, `server/cluster-actions.ts`, with `requireAuth` rejecting:
   the call rejects and the underlying `lib` function / DB is **never called**.
2. **Structural drift guard** (`.test.ts`): read every file under `server/`
   (and any other file with a top-level `"use server"` directive, found by
   scanning `app/`, `components/`, `lib/`, `server/`); for each exported async
   function, assert its body calls `requireAuth()` before anything else.
   Allowlist with a written reason: `login`, `gatewayLogin`, `logout`.
   Pattern follows the repo's existing allowlist drift test
   (`lib/__tests__/platform-catalog-drift.test.ts`).
3. **Middleware** (`.test.ts`): unauthenticated request to a page and to
   `/api/ops/*` → redirect to `/login`; `/login` passes; a valid session
   passes; a forged/garbage `godmode_session` cookie → redirect.
4. **Session hardening** (extend `session.test.ts` if not already there):
   cookie is `httpOnly`, `sameSite: "lax"`, `secure` when
   `NODE_ENV=production`; `verifyPassword` rejects empty, wrong-length, and
   near-miss secrets.
5. **Hostile input** (`.test.ts` / `.int.test.ts`):
   - row actions: malformed `pkJson` → rejects, no write; `pkJson` naming a
     column that isn't in the table → rejects, no write; schema/table names
     with quotes, `;`, NUL, >63 bytes → rejected by `ident`, no query.
   - ops routes: non-JSON body, missing fields, wrong types → 4xx, never 500,
     nothing executed. (Fix the handlers if they currently 500.)
6. **SQL console** (`.int.test.ts`, embedded PG): each attack listed under
   Vulnerability 1 is written as a test that **fails on current code**, then
   passes after Fix 1 — asserting the table is unchanged and no audit row was
   written. Plus regression tests that legitimate reads and preview → apply
   writes still work and the apply writes an audit row.
7. Every new test file passes `bun run lint` and `bun run typecheck`.

### Delivery

One branch `feature/security-test-suite`, one PR into `main`, `CHANGELOG.md`
`[Unreleased]` entry describing both fixes. TDD order is natural here: write
the failing console + `valuesFromForm` tests first, then fix.

## Claude's calls (made during builder check)

- **`WITH` classification:** keep the existing keyword scan in
  `classifyStatement` (a `WITH` mentioning `INSERT|UPDATE|DELETE|MERGE` is a
  write). A false positive only routes a read to the preview path — harmless.
  A false negative is caught by the `READ ONLY` transaction. No tokenizer.
- **Denylist / allowlist matching:** plain case-insensitive regex over the
  statement text, after stripping leading comments (as today). Over-blocking
  (e.g. `SELECT 'pg_sleep'` as a literal) is acceptable — mistake guard, not a
  sandbox. Text only; indirect calls via user-defined functions are not caught
  (and are out of scope per non-goals).
- **Middleware:** test `middleware.ts` as it exists; renaming to Next 16's
  `proxy.ts` is not in scope. The test imports the `middleware` export directly
  with a constructed `NextRequest`.

## Left to the builder

- Exact file split of the new tests, and whether the statement allowlist lives
  in `sql-guard.ts` or a new module.
- How the drift guard parses functions (regex over source vs. TypeScript
  compiler API) — must not false-pass on a commented-out `requireAuth`.
- Error message wording.
