# Carmen Inventory God Mode

Direct admin tool for the Carmen inventory PostgreSQL database. **Every change is
permanent — there is no undo.** The audit log is the only recovery record.

## Setup
1. `cp .env.example .env.local` and fill in `GOD_MODE_PASSWORD`, `SESSION_SECRET` (>=32 chars), and the DB URLs.
2. `bun install`
3. `bun run dev` (uses `.env.local`). Use `bun run dev:local` / `bun run dev:prod` / `bun run dev:uat` to pick `.env.local` / `.env.prod` / `.env.uat` explicitly. The server port comes from `PORT` in the chosen env file (3305 by default).

The `CARMEN_SYSTEM.tb_god_mode_audit` table is created automatically on the first audited operation — any delete, edit, raw-SQL write, or platform migration self-ensures it.

## Tests
- `bun run test` — unit + integration (integration uses embedded-postgres; no Docker needed). (Use `bun run test`, NOT `bun test` — the latter invokes Bun's built-in runner and cannot run our Vitest suite.)
- `bunx playwright test` — light E2E.

## Safety
- Shared-secret login; cookie session.
- Deletes show a blast-radius preview and require typing a confirm phrase.
- Deleting a business unit can optionally `DROP SCHEMA` its tenant database (off by default; requires typing the schema name).
- Raw SQL writes require an explicit Commit after a preview.
- `CASCADE_MAX_ROWS` / `CASCADE_MAX_DEPTH` cap the blast radius; an over-cap cascade is refused.

### Platform migrations page

`/platform-migrations` runs the migration scripts of the sibling
`@repo/prisma-shared-schema-backstage` package by spawning its own commands
(`prisma migrate deploy`, `db:tenant-views:apply`, `db:seed.*`). It requires:

- `BACKSTAGE_PACKAGE_DIR` — path to the package (defaults to
  `../carmen-turborepo-backend/packages/prisma-shared-schema-backstage`).
  The repo must be checked out with `node_modules` installed; `bun` and (for
  tenant views) `psql` must be on PATH.
- `SYSTEM_DIRECT_URL` — Prisma `directUrl` (non-pooled) for migrations/seeds.
  Defaults to `SYSTEM_DATABASE_URL` when unset.
- `ALLOW_DANGER_OPS` — set to `true` to expose the danger zone
  (`db:migrate:reset`). Off by default: the group is hidden from the page and
  the API refuses the op with 403. Changing it requires a server restart.

Migrations run against the DB this instance is pointed at (the banner shows the
target). Writes require typing the schema name; resets (hidden unless ALLOW_DANGER_OPS=true) need a second
confirmation. Every run is recorded in `tb_god_mode_audit`.
