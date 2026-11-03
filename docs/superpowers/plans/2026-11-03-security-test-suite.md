# Security Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Security tests on every entry point of god-mode (routes, server actions, middleware), plus fixes for the two vulnerabilities they expose (SQL console read-path writes; unauthenticated `valuesFromForm`).

**Architecture:** Console statements are vetted by a new `checkConsoleStatement()` in `lib/sql-guard.ts` (statement-kind allowlist + side-effect-function denylist), then run one-statement-only over the extended protocol, with the read path in a `READ ONLY` transaction. `valuesFromForm` and a new `parsePk` move to `lib/form-values.ts`. A source-scanning drift test enforces `requireAuth()` first in every server action.

**Tech Stack:** Next.js 16 (App Router, server actions, `middleware.ts`), postgres.js, iron-session, Vitest, embedded-postgres.

**Spec:** `docs/superpowers/specs/2026-11-03-security-test-suite-design.md`

## Global Constraints

- **Tests ARE the deliverable here** — the operator asked for them. The global "skip test steps during plan execution" preference does NOT apply to this plan; tell implementer subagents so explicitly.
- No test touches the live DB in `.env.local`. SQL behaviour → `.int.test.ts` using `@/test/pg` `startPg()`.
- `.test.ts` → node, `.test.tsx` → jsdom. Run with `bun run test` (never `bun test`).
- Route/action tests mock `@/lib/session` (`requireAuth` rejects for unauth), `next/cache` (`revalidatePath`), and for actions `next/navigation` (`redirect`).
- Type postgres results `as unknown as { … }[]`; dynamic params `as (string | number | boolean | null)[]`; no `any`. `bun run lint` and `bun run typecheck` stay clean.
- Legitimate console use keeps working: `SELECT`, `WITH … SELECT`, `EXPLAIN`, single `INSERT`/`UPDATE`/`DELETE`/`MERGE`, and DDL (`CREATE`/`ALTER`/`DROP`/`TRUNCATE`/`GRANT`/`REVOKE`/`COMMENT`) via preview → apply + audit.
- Denylist (case-insensitive, with/without `pg_catalog.` prefix and double quotes): `pg_terminate_backend`, `pg_cancel_backend`, `pg_reload_conf`, `pg_rotate_logfile`, `pg_promote`, `pg_read_file`, `pg_read_binary_file`, `pg_ls_dir`, `pg_stat_file`, `lo_import`, `lo_export`, `lo_unlink`, `dblink*`, `set_config`, `pg_advisory_*lock*`, `pg_sleep*`.
- Branch `feature/security-test-suite` (exists; spec already committed). One PR into `main`.

## Review Focus

1. Statement with a trailing semicolon (`SELECT 1;`) — must still run as one statement (extended protocol accepts it). → Task 2.
2. A `;` inside a string literal (`SELECT 'a;b'`) — must run, not be rejected as multi-statement. → Task 2.
3. Leading comments before the keyword (`-- note\nSELECT 1`, `/* x */ DELETE …`) — classified by the real keyword. → Task 1.
4. DDL preview must not persist; DDL apply must write an audit row. → Task 2.
5. Empty `{}` or non-object `pkJson` (`[]`, `"1"`, `null`) — must be rejected before SQL is built (today `{}` yields `WHERE ` with nothing after). → Task 3.

---

### Task 1: Console statement vetting (`checkConsoleStatement`)

**Files:**
- Modify: `lib/sql-guard.ts`
- Test: `lib/__tests__/sql-guard.test.ts` (extend)

**Interfaces:**
- Produces: `export class ConsoleSqlRejected extends Error {}` and `export function checkConsoleStatement(sqlText: string): "read" | "write"` — throws `ConsoleSqlRejected` for an empty statement, a disallowed leading keyword, or a denylisted function call; otherwise returns `classifyStatement(sqlText)`. `classifyStatement` keeps its current signature and behaviour.

- [ ] **Step 1: Write failing tests** in `sql-guard.test.ts`:
  - `test.each` returns `"read"`: `SELECT 1`, `-- c\nSELECT 1`, `/* c */ select 1`, `WITH x AS (SELECT 1) SELECT * FROM x`, `TABLE t`, `VALUES (1)`, `EXPLAIN SELECT 1`, `SHOW search_path`, `(SELECT 1)`.
  - `test.each` returns `"write"`: `INSERT INTO t VALUES (1)`, `update t set a=1`, `DELETE FROM t`, `MERGE INTO t USING s ON true WHEN MATCHED THEN DELETE`, `WITH d AS (DELETE FROM t RETURNING *) SELECT * FROM d`, `CREATE INDEX i ON t(a)`, `ALTER TABLE t ADD COLUMN b int`, `DROP TABLE t`, `TRUNCATE t`, `GRANT SELECT ON t TO x`, `REVOKE SELECT ON t FROM x`, `COMMENT ON TABLE t IS 'x'`, `EXPLAIN ANALYZE SELECT 1`.
  - `test.each` throws `ConsoleSqlRejected`: `""`, `"   "`, `BEGIN`, `COMMIT`, `ROLLBACK`, `END`, `ABORT`, `SAVEPOINT s`, `RELEASE s`, `START TRANSACTION`, `PREPARE TRANSACTION 'x'`, `COPY t TO PROGRAM 'x'`, `COPY t FROM STDIN`, `SET search_path TO x`, `RESET ALL`, `DISCARD ALL`, `DO $$BEGIN END$$`, `CALL p()`, `LISTEN c`, `NOTIFY c`, `VACUUM`, `LOCK TABLE t`.
  - `test.each` throws `ConsoleSqlRejected` (denylist): `SELECT pg_terminate_backend(1)`, `select PG_CANCEL_BACKEND(1)`, `SELECT pg_catalog.pg_terminate_backend(1)`, `SELECT "pg_terminate_backend"(1)`, `SELECT pg_catalog."pg_sleep" (1)`, `SELECT pg_sleep_for('1s')`, `SELECT pg_advisory_xact_lock(1)`, `SELECT set_config('a','b',false)`, `SELECT dblink_exec('x','y')`, `SELECT lo_unlink(1)`, `SELECT pg_read_file('/etc/passwd')`, `UPDATE t SET a = pg_reload_conf()`.
  - `SELECT 1 AS pg_sleep_count` → `"read"` (no `(` follows — not a call).

- [ ] **Step 2: Run** `bun run test lib/__tests__/sql-guard.test.ts` — Expected: FAIL (`checkConsoleStatement` not exported).

- [ ] **Step 3: Implement** in `lib/sql-guard.ts`. Reuse `stripLeading`. Leading keyword = first `[A-Z]+` word (or `(`) of the stripped, upper-cased text. Allowed read keywords: `SELECT WITH TABLE VALUES EXPLAIN SHOW (`; allowed write keywords: `INSERT UPDATE DELETE MERGE CREATE ALTER DROP TRUNCATE GRANT REVOKE COMMENT`. Denylist check: lower-case the whole text, delete all `"`, then test
  `/\b(pg_terminate_backend|pg_cancel_backend|pg_reload_conf|pg_rotate_logfile|pg_promote|pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_import|lo_export|lo_unlink|dblink\w*|set_config|pg_advisory_\w*lock\w*|pg_sleep\w*)\s*\(/`. Add a short comment: mistake guard, not a sandbox (link the spec). Error messages name the rejected keyword / function.

- [ ] **Step 4: Run** the same command — Expected: PASS.

- [ ] **Step 5: Commit** `git add lib/sql-guard.ts lib/__tests__/sql-guard.test.ts && git commit -m "feat(sql-guard): vet console statements (allowlist + side-effect denylist)"`

---

### Task 2: Harden console execution (one statement, read-only read path)

**Files:**
- Modify: `lib/db.ts` (`withTransaction`), `lib/sql-runner.ts`, `server/sql.ts`
- Create: `lib/__tests__/sql-console-attacks.int.test.ts`, `lib/__tests__/server-sql-auth.test.ts`

**Interfaces:**
- Consumes: `checkConsoleStatement`, `ConsoleSqlRejected` (Task 1).
- Produces: `withTransaction<T>(schema: string | null, fn: (tx: TransactionSql) => Promise<T>, opts?: { readOnly?: boolean }): Promise<T>` — `readOnly` uses `getSql().begin("read only", …)`. Existing callers unchanged.

- [ ] **Step 1: Write the failing int test** `sql-console-attacks.int.test.ts`. Setup copies `sql-runner.int.test.ts` (schema `app`, table `item` with 3 rows, `ensureAuditTable()`, session mock), plus mock `requireAuth` to resolve. Call through `runSql` / `applySql` from `@/server/sql`. Helper `itemCount()` and `auditCount()` (`SELECT count(*)::int n FROM "CARMEN_SYSTEM".<audit table>` — read the table name from `lib/audit.ts`). Tests, each asserting the stated outcome **and** `itemCount() === 3` and audit count unchanged unless stated:
  - `runSql("app", "SELECT 1; DELETE FROM item")` rejects.
  - `runSql("app", "SELECT 1; COMMIT; DELETE FROM item")` rejects.
  - `applySql("app", "DELETE FROM item WHERE id=1; DELETE FROM item")` rejects (multi-statement on the write path too).
  - `runSql("app", "SELECT * INTO item_copy FROM item")` rejects, and `to_regclass('app.item_copy')` is null.
  - `runSql("app", "SELECT setval(pg_get_serial_sequence(...))")` — create a serial table `app.seq_t` in setup; rejects and `last_value` unchanged.
  - `runSql("app", "SELECT pg_terminate_backend(pg_backend_pid())")` rejects with `ConsoleSqlRejected`, and a follow-up `runSql("app","SELECT 1")` succeeds.
  - Regression: `runSql("app","SELECT 1;")` → `kind "read"`; `runSql("app","SELECT 'a;b' AS v")` → row `v === "a;b"`; `runSql("app","DELETE FROM item WHERE id=1")` → `write-preview`, affected 1, count still 3; `applySql` same → `write-applied`, count 2, audit +1 (restore the row after).
  - DDL: `runSql("app","CREATE TABLE ddl_t(a int)")` → preview, `to_regclass('app.ddl_t')` null; `applySql` same → table exists, audit +1.

- [ ] **Step 2: Write failing** `server-sql-auth.test.ts`: mock `@/lib/session` (`requireAuth` rejects), mock `@/lib/sql-runner` with `vi.fn`s; `runSql("app","SELECT 1")` and `applySql("app","SELECT 1")` reject and no runner fn is called.

- [ ] **Step 3: Run** `bun run test lib/__tests__/sql-console-attacks.int.test.ts lib/__tests__/server-sql-auth.test.ts` — Expected: the attack tests FAIL (proves the vulnerability); the auth test may already pass — fine, it is a regression pin.

- [ ] **Step 4: Implement.**
  - `lib/db.ts`: add the `opts.readOnly` parameter above.
  - `lib/sql-runner.ts`: every console `tx.unsafe(statement)` becomes `tx.unsafe(statement, [], ONE_STATEMENT)` with `const ONE_STATEMENT = { simple: false } as unknown as UnsafeQueryOptions` (postgres.js types omit `simple`; see `node_modules/postgres/src/index.js:124`). `runRead` passes `{ readOnly: true }`.
  - `server/sql.ts`: replace `classifyStatement` with `checkConsoleStatement` in both actions (after `requireAuth()`, before any runner call).

- [ ] **Step 5: Run** the Step 3 command plus `bun run test lib/__tests__/sql-runner.int.test.ts` — Expected: all PASS.

- [ ] **Step 6: Commit** `git commit -m "fix(sql-console): one statement per run, read path READ ONLY, vetted statements"` (stage the 5 files).

---

### Task 3: Row actions — move helpers out of `"use server"`, auth + hostile-input tests

**Files:**
- Create: `lib/form-values.ts`
- Modify: `server/rows.ts`, `server/cluster-actions.ts`
- Create: `lib/__tests__/form-values.test.ts`, `lib/__tests__/server-rows-auth.test.ts`

**Interfaces:**
- Produces:
  - `export async function valuesFromForm(schema: string, table: string, formData: FormData, includeAllColumns: boolean): Promise<Record<string, unknown>>` — moved verbatim from `server/rows.ts`.
  - `export function parsePk(pkJson: string): Record<string, unknown>` — throws `Error("Invalid primary key")` unless `JSON.parse` succeeds and yields a non-null, non-array object with ≥1 key whose values are all `string | number | boolean`.

- [ ] **Step 1: Write failing** `form-values.test.ts`: `parsePk('{"id":1}')` → `{id:1}`; `parsePk('{"a":"x","b":2}')` ok; throws for `"not json"`, `"{}"`, `"[]"`, `"null"`, `'"1"'`, `'{"id":null}'`, `'{"id":{"$ne":1}}'`, `'{"id":[1]}'`.

- [ ] **Step 2: Write failing** `server-rows-auth.test.ts`: mock `@/lib/session` (`requireAuth` rejects), `next/cache`, `next/navigation`, `@/lib/write` (`applyInsert`, `applyUpdate` as `vi.fn`), `@/lib/soft-delete`, `@/lib/form-values` (`valuesFromForm` vi.fn, real `parsePk` via `vi.importActual`). For each of `submitInsert`, `submitUpdate`, `softDeleteClusters`, `restoreClusters`, `submitClusterInsert`, `submitClusterUpdate`: rejects and no mocked lib fn called. Then with `requireAuth` resolving: `submitUpdate("app","item","{}",fd)` and `submitClusterUpdate("not json", fd)` reject with `/invalid primary key/i` and `applyUpdate` not called. Assert `server/rows.ts` module has no `valuesFromForm` export (`expect("valuesFromForm" in mod).toBe(false)`).

- [ ] **Step 3: Run** `bun run test lib/__tests__/form-values.test.ts lib/__tests__/server-rows-auth.test.ts` — Expected: FAIL.

- [ ] **Step 4: Implement**: create `lib/form-values.ts` (no `"use server"`); delete `valuesFromForm` from `server/rows.ts`; both server files import `valuesFromForm` and `parsePk` from `@/lib/form-values` and use `parsePk(pkJson)` in place of `JSON.parse(pkJson) as …`.

- [ ] **Step 5: Run** Step 3 command + `bun run typecheck` — Expected: PASS, no type errors.

- [ ] **Step 6: Commit** `git commit -m "fix(server): valuesFromForm no longer a public server action; validate pkJson"`

---

### Task 4: Ops routes — malformed bodies return 400, never 500

**Files:**
- Create: `lib/request-body.ts`
- Modify: `app/api/ops/cascade-delete/route.ts`, `app/api/ops/drop-schema/route.ts`, `app/api/ops/platform-migrate/route.ts`
- Test: `lib/__tests__/ops-routes-malformed.test.ts`

**Interfaces:**
- Produces: `export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null>` — `null` if the body isn't valid JSON or isn't a plain (non-array, non-null) object.

- [ ] **Step 1: Write failing test.** Mock session (resolving), `next/cache`, and each route's executor modules as the existing route tests do (`drop-schema-route.test.ts`, `cascade-route.int.test.ts`, `platform-migrate-route.test.ts` show the mock sets). For each of the 3 `POST` handlers, `test.each` bodies `"not json"`, `"[]"`, `"null"`, `"42"` → `status 400`, JSON `error` string present, executor not called. Plus: cascade-delete with `pks: "x"` → 400; drop-schema with `schema: 123` → 400; platform-migrate with `opId: 5` → 4xx.

- [ ] **Step 2: Run** `bun run test lib/__tests__/ops-routes-malformed.test.ts` — Expected: FAIL (throws/500).

- [ ] **Step 3: Implement** `readJsonObject`; in each handler, right after the auth block, `const body = await readJsonObject(request); if (!body) return 400 {error:"Request body must be a JSON object"}` then destructure from `body as Body`. Keep existing field checks.

- [ ] **Step 4: Run** Step 2 command plus the three existing route test files — Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "fix(api): reject malformed request bodies with 400"`

---

### Task 5: Middleware + session hardening tests (test-only)

**Files:**
- Create: `lib/__tests__/middleware.test.ts`
- Modify: `lib/__tests__/session.test.ts`

- [ ] **Step 1: Write** `middleware.test.ts`. Set env as `session.test.ts` does (`SESSION_SECRET = "x".repeat(32)`). Build requests with `new NextRequest("http://test/<path>", { headers: { cookie } })`; make a valid cookie with iron-session `sealData({ authed: true }, { password: SESSION_SECRET })` → `godmode_session=<sealed>`. Tests:
  - no cookie, `/` → response status 307/308 and `location` ends with `/login`.
  - no cookie, `/api/ops/drop-schema` → redirect to `/login`.
  - no cookie, `/login` → not a redirect (no `location`).
  - `godmode_session=garbage` on `/` → redirect.
  - sealed `{ authed: false }` → redirect.
  - sealed `{ authed: true }` → not a redirect.
  - sealed with a *different* 32-char password → redirect (forged).

- [ ] **Step 2: Extend** `session.test.ts`: `sessionOptions.cookieOptions` has `httpOnly: true`, `sameSite: "lax"`; with `NODE_ENV="production"` and `vi.resetModules()`, a fresh import has `secure: true`; `verifyPassword` false for `"hunter"`, `"hunter22"`, `"Hunter2"`, `"hunter2 "`.

- [ ] **Step 3: Run** `bun run test lib/__tests__/middleware.test.ts lib/__tests__/session.test.ts` — Expected: PASS. If any assertion fails, that is a real finding: stop and report it rather than changing the assertion.

- [ ] **Step 4: Commit** `git commit -m "test: pin middleware gate and session cookie hardening"`

---

### Task 6: Drift guard — every server action calls `requireAuth()` first

**Files:**
- Create: `lib/__tests__/server-action-auth-drift.test.ts`

- [ ] **Step 1: Write the test.** Walk `app/`, `components/`, `lib/`, `server/` (skip `__tests__`, `node_modules`). A file is a server-action module if its first non-comment statement is `"use server"` / `'use server'`. Separately, fail if any other file contains a `"use server"` directive inside a function (inline actions are not allowed unguarded — list them). For each module, after stripping `//` and `/* */` comments:
  - fail on `export const|let … = async`, `export default`, or `export { … }` (only `export async function` is permitted, so the guard can see every action);
  - for each `export async function NAME(`, take the body after its opening `{` and assert the first statement matches `/^\s*(const\s+\w+\s*=\s*|\w+\s*=\s*)?await\s+requireAuth\(\)/`.
  - Allowlist with reasons: `login` and `gatewayLogin` (they establish auth), `logout` (destroys session; harmless unauthenticated).
  - Self-check: an inline fixture string with a commented-out `// await requireAuth();` is reported as a violation by the same function (prevents false pass).

- [ ] **Step 2: Run** `bun run test lib/__tests__/server-action-auth-drift.test.ts` — Expected: PASS (Task 3 removed `valuesFromForm`). Temporarily re-add an unguarded `export async function x(){}` to `server/sql.ts`, confirm FAIL, revert.

- [ ] **Step 3: Commit** `git commit -m "test: drift guard — server actions must requireAuth first"`

---

### Task 7: Changelog, full checks, PR

**Files:**
- Modify: `CHANGELOG.md` (`[Unreleased]`, Thai prose like existing entries)

- [ ] **Step 1:** Under `## [Unreleased]` add `### Security` with two Thai prose lines: SQL console no longer lets a `SELECT`-led statement write unaudited (one statement per run, read path read-only, system functions blocked; DDL still via preview); `valuesFromForm` no longer exposed as an unauthenticated server action. Add `### Added`: security tests across all entry points + drift guard.
- [ ] **Step 2:** Run `bun run lint && bun run typecheck && bun run test` — Expected: all clean/green.
- [ ] **Step 3:** `trail check` — Expected: exit 0 (or explain conflict in PR body).
- [ ] **Step 4:** Commit, `git push -u origin feature/security-test-suite`, `gh pr create --base main` with a summary of both vulnerabilities, the operator's DDL decision, and test counts. Manual check to offer the operator: on `bun run dev`, SQL console runs `SELECT 1`, rejects `SELECT 1; SELECT 2`, previews a `CREATE TABLE`.
