# "Delete BU only" for a soft-deleted BU on a shared schema — design

## Intent
A recreated business unit reuses its soft-deleted twin's tenant schema
(BU-D3CX2M5K deleted → BU-2N0F1YB7 on `carmen_avglc`). Removing the dead twin's
registry row is already safe — the confirm page refuses the schema drop when a
live BU still uses it (PR #44) — but the /schemas table shows the same "Delete"
button on every row, so the operator can't tell that this delete leaves the
schema alone. Make that path visible and explicit.

## Goals / non-goals
- Goal: a soft-deleted BU whose tenant schema is used by a live BU shows a
  "Delete BU only" action; its confirm page states plainly that the schema is kept.
- Non-goal: changing what gets deleted (cascade of `tb_business_unit` + its
  system-schema children stays as is), the API, or the confirm phrase (`DELETE`).
- Non-goal: the table button for live BUs that share a schema stays "Delete".
  (Their confirm page does get the clearer copy below — the outcome is the same:
  the schema is kept.)
- Anti-goal: any one-click delete that skips the confirm page / SealConfirm.

## Approaches
1. Relabel the table button only.
2. **Chosen:** relabel the button **and** rework the confirm page for that case.
   Picked because the disabled checkbox plus a red "shared" alert reads as an error,
   when here this is the expected outcome.
3. One-click delete from the table — rejected: bypasses the confirm ceremony.

## Design
- **Condition** ("BU-only case"): `b.deletedAt && b.tenantSchema && usage.has(b.tenantSchema)`.
  `loadSchemaUsage()` counts only live BUs, so a hit means another live BU uses it.
- **`app/(god)/schemas/page.tsx`**: pass `sharedSchemas` (`schema → live codes`,
  from the already-loaded `usage` map) into `BusinessUnitsTable`. Plain objects only
  (RSC boundary — no `Map` across server→client props).
- **`components/business-units-table.tsx`**: in the BU-only case the row action
  reads "Delete BU only", with `title` = `Schema <s> is shared with <codes> and will be kept`.
  Same href as today.
- **`components/confirm-delete.tsx`**: when `isBusinessUnit && sharedWarning`
  (and no `poolWarning`), replace the danger "Tenant schema is shared" alert and the
  disabled drop checkbox with an info alert: "Deletes this business unit's registry
  config only. Schema `<s>` is kept — still used by <codes>." The hint about the phrase
  turning into the schema name is also hidden. Pool-mismatch and cluster paths unchanged.
- **"All schemas" list** (`app/(god)/schemas/page.tsx`): drop the rows that would
  read "In use · <codes>" (`usage.has(s)`, i.e. a live BU points at it) — they
  duplicate the Business units table, which already shows the schema and an Open
  link. Protected schemas and schemas used only by soft-deleted BUs (droppable
  orphans) stay listed. (User request, 2026-11-23.)
- Server/API untouched: the 409 guard in `app/api/ops/cascade-delete/route.ts` still
  backs this up.

## Left to the builder
Exact copy wording within the above; existing component tests updated to match.
