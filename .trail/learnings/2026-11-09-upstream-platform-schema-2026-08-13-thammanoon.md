---
title: Upstream platform schema (2026-08-13) split tb_business_unit.db_connection into…
author: Thammanoon
date: 2026-11-09
id: l-66c0523b
scope: repo
status: active
touches:
  - lib/db.ts
  - lib/registry.ts
  - "lib/db.ts#getSql"
---

## Decided
On 2026-08-13 the upstream platform schema replaced `CARMEN_SYSTEM.tb_business_unit.db_connection jsonb`
with two columns: `db_schema varchar` (tenant schema name) and `database_pool_id uuid` → `tb_database_pool`
(host/port/database/username). Today every real BU points at the single pool
`dev.blueledgers.com:6432/postgres`, which is the same host as `DATABASE_URL`.

**Why:** god-mode holds ONE `postgres()` connection (`lib/db.ts` `getSql()`) and resolves tenant schemas
purely by name (`lib/registry.ts`). It never reads `database_pool_id`. The moment a BU is assigned a
different pool, god-mode will silently operate on the wrong database — `DROP SCHEMA` on cascade delete
targets whatever schema of that name exists on `DATABASE_URL`'s host.

## Watch out
before trusting any tenant-schema operation (cascade delete, schema browsing), check
whether `tb_business_unit.database_pool_id` still resolves to the same host as `DATABASE_URL`.
Integration tests seed their own tables, so they cannot catch this drift — see rsc-run-the-app.

_From Claude Code's memory of this repo, last updated Aug 18._
