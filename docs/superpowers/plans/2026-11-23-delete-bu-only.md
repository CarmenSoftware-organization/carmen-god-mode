# "Delete BU only" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "delete only the BU's registry config, keep the shared schema" path explicit on /schemas and its confirm page, and drop the duplicated "In use" rows from "All schemas".

**Architecture:** UI-only. `app/(god)/schemas/page.tsx` already loads `loadSchemaUsage()`; it passes a plain-object view of it into `BusinessUnitsTable` and filters the "All schemas" list. `ConfirmDelete` swaps its shared-schema danger alert + disabled checkbox for an info alert. API and cascade logic are untouched.

**Tech Stack:** Next.js (app router, RSC), React 19, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-23-delete-bu-only-design.md`

## Global Constraints
- No new automated tests (user preference); existing suites must stay green; `bun run typecheck` + `bun run lint` clean.
- Server→client props are plain JSON (no `Map`) — RSC boundary.
- Confirm phrase stays `DELETE`; SealConfirm ceremony stays.
- Copy is English, matching the rest of the UI.

## Review Focus
- A soft-deleted BU whose schema is used only by other *soft-deleted* BUs → not in `usage` → keeps plain "Delete" (drop stays possible). Expected.
- A BU with `tenantSchema === null` → plain "Delete".
- `poolWarning` and `sharedWarning` both set → pool-warning path wins (keep danger alert + disabled checkbox), since the schema isn't even on this host.
- "All schemas": a protected schema that's also in `usage` stays listed as Protected (protected check comes first).

---

### Task 1: /schemas page — relabel action, hide in-use rows

**Files:**
- Modify: `app/(god)/schemas/page.tsx`
- Modify: `components/business-units-table.tsx`

**Interfaces:**
- Produces: `BusinessUnitsTable` prop `sharedSchemas?: Record<string, string[]>` (schema → live BU codes; default `{}`).

- [ ] **Step 1:** In `page.tsx`, pass `sharedSchemas={Object.fromEntries(usage)}` to `BusinessUnitsTable`. Change the "All schemas" list to iterate `sel.allSchemas.filter((s) => isProtectedSchema(s) || !usage.has(s))` and delete the `usage.has(s)` "In use · …" branch.
- [ ] **Step 2:** In `business-units-table.tsx`, for a row where `b.deletedAt && b.tenantSchema && sharedSchemas[b.tenantSchema]?.length`, render the delete button label `Delete BU only` and set the `<Link>`'s `title` to `` `Schema ${b.tenantSchema} is shared with ${codes.join(", ")} and will be kept` ``. Same href. Other rows unchanged (`Delete`).
- [ ] **Step 3:** `bun run typecheck && bun run lint && bun run test components/__tests__/business-units-table.test.tsx` → all pass.
- [ ] **Step 4:** Commit `feat(schemas): label the BU-only delete for a shared schema, hide in-use rows`.

### Task 2: Confirm page — "schema kept" info alert

**Files:**
- Modify: `components/confirm-delete.tsx`

- [ ] **Step 1:** Define `const keepsSharedSchema = isBusinessUnit && !!tenantSchema && !!sharedWarning && !poolWarning;`. When true:
  - render `<Alert variant="info" title="Deletes this business unit's registry config only">` with body `` `Schema "${tenantSchema}" is kept. ${sharedWarning}` `` in place of the danger "Tenant schema is shared" alert;
  - do not render the BU drop-schema checkbox label nor the "required phrase becomes the schema name" hint.
  Cluster (`orphanSchemas`) and pool-warning paths keep their current rendering. `dropBlocked` logic unchanged (still sends `dropSchema: false`).
- [ ] **Step 2:** `bun run typecheck && bun run lint && bun run test components/__tests__/confirm-delete.test.tsx` → all pass.
- [ ] **Step 3:** Commit `feat(delete): state plainly that a shared schema is kept on BU delete`.

### Task 3: Verify and ship

- [ ] **Step 1:** `bun run test` (full suite) → no new failures vs `main`.
- [ ] **Step 2:** Browser check on http://localhost:3310/schemas: BU-D3CX2M5K row shows "Delete BU only" with tooltip; `carmen_avglc` absent from "All schemas"; its confirm page shows the info alert, no checkbox. Do **not** submit the delete.
- [ ] **Step 3:** `trail check`, commit spec + plan, push, open PR to `main`.
