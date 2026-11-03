---
title: "Console SQL denylist must match raw AND comment-stripped text; pkJson keys must equal the table's PK"
author: Thammanoon
date: 2026-11-03
branch: main
cost: { minutes: 50, tokens: 235441 }
id: l-ab4f4cb5
scope: repo
status: active
src: agent
touches:
  - lib/__tests__/sql-console-attacks.int.test.ts
  - lib/__tests__/form-values.test.ts
  - lib/__tests__/server-rows-auth.test.ts
  - lib/__tests__/sql-guard.test.ts
  - lib/form-values.ts
  - lib/sql-guard.ts
  - server/cluster-actions.ts
  - server/rows.ts
  - lib/__tests__/server-action-auth-drift.test.ts
  - lib/__tests__/middleware.test.ts
---

## Tried and ruled out
- Matching the side-effect denylist in lib/sql-guard.ts only on comment-stripped text: the stripper is not string-literal aware, so `SELECT '--', pg_sleep(1)` hid the call. Matching only raw text misses `pg_sleep/**/(1)`. Both passes are required.
- Parsing EXPLAIN option lists for `ANALYZE false`: missed the `ANALYSE` spelling and duplicate options. EXPLAIN is now a write whenever ANALY[SZ]E appears (fail closed; costs only a preview).

## Watch out
- A pkJson with real non-PK columns (e.g. {"status":"active"}) made applyUpdate run a multi-row UPDATE audited as one row. server/rows.ts + server/cluster-actions.ts now require pk keys == describeTable().primaryKey, so tables with no PK can't be edited via the row form.
- The ecc config-protection hook blocks edits to eslint.config.mjs; `.trail/*.cjs` lint errors need a manual ignore entry.
