---
title: "A tenant schema that a live business unit points at can't be dropped on its own; remove it through the business-unit delete"
author: Thammanoon
date: 2026-11-23
branch: fix/block-drop-schema-in-use
cost: { minutes: 13, tokens: 170337 }
id: l-b02812ee
scope: repo
status: active
src: agent
touches:
  - "app/(god)/schemas/[name]/delete/page.tsx"
  - app/(god)/schemas/page.tsx
  - app/api/ops/drop-schema/route.ts
  - lib/__tests__/drop-schema-route.test.ts
  - lib/__tests__/ops-routes-malformed.test.ts
  - lib/drop-schema.ts
  - lib/registry.ts
  - ".env.example"
  - README.md
  - lib/env.ts
---

## Decided
The /schemas "All schemas" list comes straight from pg_namespace, so it used to offer Delete on tenant schemas a live BU still uses (BL_AVG for BLAVG). A schema with any BU whose `db_schema` points at it and whose `deleted_at IS NULL` is now refused at every layer: list UI, confirm page, API (409), and executeDropSchema (fail-closed). To remove such a tenant, delete the BU; that path carries the pool guard.
Schemas referenced only by soft-deleted BUs stay droppable on purpose, so orphans can be cleaned up.
Shared platform schemas (CARMEN_FILE, CRONJOBS, ISO_PROD, ISO, QA_MANUAL) are protected through a comma-separated env list. The match is exact and case-sensitive. The system schema and `public` stay hard-coded as protected, so a missing or mistyped env line can never make them droppable. The env list only adds schemas; it never replaces the built-in ones.
A BU that gets recreated reuses the schema of its soft-deleted twin (BU-D3CX2M5K was deleted, then BU-2N0F1YB7 was created on carmen_avglc three minutes later). Deleting a BU or cluster may drop the schema only when no live BU outside that delete still uses it. A BU delete checks every other BU; a cluster delete checks BUs outside the cluster. The confirm page disables the drop checkbox and the API returns 409.
The BU table shows a "Deleted" badge, because a soft-deleted BU can still have is_active = true and otherwise looks identical to the live one.

## Watch out
Several BUs can share one schema (carmen_avglc has one live BU and one soft-deleted BU). The usage map holds a list of codes for that reason.

In the code: lib/registry.ts loadSchemaUsage(), lib/drop-schema.ts inUseReason(), app/api/ops/drop-schema/route.ts, app/(god)/schemas/page.tsx, app/(god)/schemas/[name]/delete/page.tsx
The env files are gitignored, so every environment (local, prod, uat, deploy targets) has to set the list itself. A machine without it falls back to protecting only the system schema and `public`. The env is read once at startup, so changing the list needs a server restart.

In the code: `PROTECTED_SCHEMAS` in lib/env.ts (`protectedSchemas`), checked in lib/drop-schema.ts `protectedReason()`, documented in `.env.example` + README.md

## Tried and ruled out
Retrying the query without `deleted_at` on error 42703: the int-test registries are missing `code` as well, so the retry still failed. Reading columns through `to_jsonb(b) ->> 'col'` works on any registry shape. A missing `deleted_at` counts every BU as live, which errs toward protecting the schema.

In the code: lib/registry.ts sharedSchemaReason(), LIVE_BU / LIVE_BU_CODE, listBusinessUnits() deletedAt; app/api/ops/cascade-delete/route.ts; components/confirm-delete.tsx sharedWarning; components/business-units-table.tsx
