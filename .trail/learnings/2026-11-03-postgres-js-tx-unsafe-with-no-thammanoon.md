---
title: "postgres.js tx.unsafe() with no params runs multiple statements; every export in a \"use server\" file is a public endpoint"
author: Thammanoon
date: 2026-11-03
branch: feature/security-test-suite
cost: { minutes: 23, tokens: 51696 }
id: l-dbb2f897
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/specs/2026-11-03-security-test-suite-design.md
  - lib/sql-runner.ts
  - server/rows.ts
---

## Watch out
- `tx.unsafe(sql)` with no args uses the simple protocol (node_modules/postgres/src/index.js:124, `simple: args.length === 0`), so `SELECT 1; DELETE ...` or `SELECT 1; COMMIT; ...` runs every statement. lib/sql-runner.ts runRead relied on classifyStatement's leading keyword and committed such input with no preview/audit. Pass `{ simple: false }` to force one statement.
- Every exported async function in a `"use server"` file is callable by anyone as a server action. server/rows.ts exported `valuesFromForm` with no requireAuth (unauth table introspection). Helpers belong in lib/, not server/.

## Decided
- SQL console guard (spec docs/superpowers/specs/2026-11-03-security-test-suite-design.md): one statement, READ ONLY read path, statement-kind allowlist (DDL stays allowed via preview+apply per operator), regex denylist of side-effect functions. Mistake guard, not a sandbox.
