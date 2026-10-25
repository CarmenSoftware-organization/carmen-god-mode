@AGENTS.md

# Carmen Inventory God Mode — working notes

Admin tool over a **live** Postgres; every write is permanent and `.env.local`
points at the real dev DB — treat cascade delete / `DROP SCHEMA` as prod data.
(Setup & safety: README.md.)

## Git
- **Every change reaches `main` through a branch and a PR** — `fix/…` / `feature/…`, then `gh pr merge` once checks pass. No direct commit or push to `main`, chores and one-line config edits included; a request phrased as "commit and push" still means branch + PR.
- No `develop` branch exists: PRs target `main`. `UAT` is a separate environment branch, never a PR base unless asked.
- **One exception: the release commit from `bun run build:bump`**, which commits and tags on `main` and is then pushed directly (`git push origin main && git push origin vX.Y.Z`). Routing it through a PR would tag the branch commit while `main` got the merge commit, leaving the tag pointing at something not on `main` — which is why the script asserts it runs on `main`. Nothing else claims this exception.

## Commands
- `bun run dev`/`start` — port **3305** (not 3000), set via `PORT` in the env file. `bun run dev` = `dev:local` (`.env.local`); `bun run dev:prod` uses `.env.prod`; `dev:uat` uses `.env.uat`. `bun run test` (Vitest — never `bun test`), `bun run typecheck`, `bun run lint`.
- E2E: `node_modules/.bin/playwright test` (auto-starts/reuses the dev server). `bun <file.ts>` auto-loads `.env.local`.
- `/platform-migrations` page runs the `prisma-shared-schema-backstage` package's own scripts via subprocess (`lib/run-process.ts`, `lib/platform-package.ts`, `lib/platform-migrations.ts`, `app/api/ops/platform-migrate/route.ts`); needs `BACKSTAGE_PACKAGE_DIR` + `SYSTEM_DIRECT_URL`, `bun`/`psql` on PATH. Spec: `docs/superpowers/specs/2026-06-29-platform-migrations-page-design.md`.
- `bun run build:bump` — cut a release: bumps `package.json`, promotes `CHANGELOG.md`'s `[Unreleased]` section into a dated `vX.Y.Z` heading, and makes a `chore(release): vX.Y.Z` commit (both files) plus an annotated `vX.Y.Z` tag. **Local only — it never pushes.** Runs on `main` with a clean tree that's not behind its upstream (skipped if no upstream is configured), gates on `typecheck` + `lint`, and prompts for patch/minor/major; pass the level (`bun run build:bump patch`) to skip the prompt. Spec: `docs/superpowers/specs/2026-08-05-build-bump-design.md`.
- **Two passes.** With `[Unreleased]` empty, the first run writes a draft there from the commits since the last tag and stops — those lines are commit subjects, and this repo's notes are prose. Rewrite them, then run the same command again; don't commit the changelog yourself, the release commit stages it. `CHANGELOG.md` is the only file the tree guard lets be dirty, which keeps that edit out of a commit on `main` outside a PR. Draft logic + tests: `scripts/changelog.ts`.

## Tests
- `.test.ts` → node; `.test.tsx` → jsdom; `.int.test.ts` → embedded-postgres via `@/test/pg` `startPg()` (fresh container/file, `fileParallelism: false`, 60s timeout).
- Route/int tests mock `@/lib/session` (`requireAuth` throws on unauth) + `next/cache` (`revalidatePath`); test a handler by importing `POST` and passing a `Request`.
- `bun run lint` is **clean** repo-wide — keep it that way. Type `postgres` query results via `(await sql.unsafe(...)) as unknown as { … }[]`; pass dynamic `unknown[]` SQL params as `as (string | number | boolean | null)[]` (don't reach for `any`).

## Postgres gotchas
- Unquoted identifiers are lowercased (`CREATE SCHEMA Foo`→`foo`); quote to match `ident()`/`qualified()` from `lib/sql-guard`.
- A `postgres` Row won't cast to a typed shape — use `as unknown as { … }` (TS2352).
- A JS string passed as `$n::jsonb` is double-encoded; embed JSON inline as `'{…}'::jsonb`.

## Layout & patterns
- `lib/` = DB/domain helpers, `server/` = `"use server"` actions, `app/api/**/route.ts` = handlers. SQL via `lib/sql-guard`; audit every write via `lib/audit`.
- **Streaming progress**: `lib/progress.ts` `streamOperation()` streams NDJSON; long ops take optional `onProgress`; client = `useOperationStream` + `<OperationProgress>`; `app/api/ops/*` handlers re-run `requireAuth` + re-validate the confirm phrase before streaming. Spec: `docs/superpowers/specs/2026-06-26-streaming-progress-design.md`.
- E2E against the live DB must self-seed throwaway rows (unique prefix) + clean up in before/afterAll — see `e2e/streaming-delete.spec.ts`.
- `.superpowers/` = SDD orchestration scratch (gitignored).
