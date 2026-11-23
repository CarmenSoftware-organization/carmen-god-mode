---
title: "A soft-deleted business unit on a shared schema is removed as config only, and in-use schemas are listed once, under business units"
author: Thammanoon
date: 2026-11-23
branch: feature/delete-bu-only
cost: { minutes: 10, tokens: 89029 }
id: l-6b4cfca6
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/plans/2026-11-23-delete-bu-only.md
  - docs/superpowers/specs/2026-11-23-delete-bu-only-design.md
  - components/confirm-delete.tsx
  - app/(god)/schemas/page.tsx
  - components/business-units-table.tsx
  - lib/registry.ts
---

## Decided
On /schemas, a soft-deleted BU whose tenant schema a live BU still uses gets a "Delete BU only" action. Its confirm page says plainly that the schema is kept (info alert), not a red warning plus a disabled checkbox, because keeping the schema is the expected outcome there. The user chose this over relabelling the button alone.
The "All schemas" list no longer shows schemas a live BU uses. The user asked for this because they duplicated the Business units table, which already shows the schema with an Open link. Protected schemas and orphans (used only by soft-deleted BUs) stay listed, so orphans can still be dropped.
The Cluster column on the Business units table is filled by mapping each BU's cluster id against the separately loaded cluster list. Cluster code is shown, name on hover, and a soft-deleted cluster is struck through.

## Tried and ruled out
A one-click delete straight from the table, skipping the confirm page. Ruled out because every delete in god-mode goes through the blast-radius + typed-phrase ceremony.
A LEFT JOIN on tb_cluster inside the business-unit query. The BU query treats "table missing" (42P01) as "no business units". On a registry without tb_cluster (some int-test registries are partial), the join would make the whole BU list come back empty. The same query also feeds platform-migrations, so it would break there too.

## Watch out
When both a pool mismatch and a shared schema apply, the pool-mismatch rendering wins, because the schema isn't on this host at all.
This is UI only. The real guard is still the 409 in the cascade-delete API.

In the code: components/business-units-table.tsx (sharedSchemas prop, buOnly), components/confirm-delete.tsx (keepsSharedSchema), app/(god)/schemas/page.tsx (Object.fromEntries(usage), filter on usage.has)
A BU whose cluster id isn't in the cluster list shows "unknown" (not "none"), so dangling references stay visible.

In the code: app/(god)/schemas/page.tsx (listClusters → clusters map), components/business-units-table.tsx (clusters prop), lib/registry.ts listBusinessUnits() left unchanged
