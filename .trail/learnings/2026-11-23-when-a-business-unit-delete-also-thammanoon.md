---
title: "When a business-unit delete also drops its schema, the confirm phrase must switch to the schema name in the browser too"
author: Thammanoon
date: 2026-11-23
branch: fix/schemas-critique
cost: { minutes: 14, tokens: 145631 }
id: l-0a46a7f7
scope: repo
status: active
src: agent
touches:
  - "app/(god)/[schema]/[table]/delete/page.tsx"
  - "app/(god)/schemas/[name]/delete/page.tsx"
  - app/(god)/schemas/page.tsx
  - components/__tests__/business-units-table.test.tsx
  - components/business-units-table.tsx
  - components/confirm-delete.tsx
  - components/sidebar.tsx
  - components/ui/button.tsx
  - components/ui/checkbox.tsx
  - components/ui/sortable-th.tsx
---

## Decided
- The confirm phrase is decided in two places, and both must agree:
  - The server requires the schema name, not DELETE, when a single business unit is deleted together with its schema.
  - The delete page renders before anyone ticks the drop box, so it can only pass the base phrase. The confirm component therefore switches to the schema name in the browser and shows that switch next to the input.

## Watch out
- Before the fix, the browser always sent DELETE. Every delete that also dropped the schema failed with a 400 ("Confirmation text must equal …"). No test caught it, because the component tests only exercise DELETE.
- Unchecked checkboxes had looked checked because the tick icon was always drawn. The tick sits inside the sibling span, not on it, so `peer-checked:` has to target it through that span.

In the code:
- app/api/ops/cascade-delete/route.ts: `requiredPhrase({ dropSchema: dropSchemas[0] })` sets the server-side phrase.
- components/confirm-delete.tsx: `dropsBuSchema` and `phrase` do the switch in the browser.
- components/ui/checkbox.tsx: `peer-checked:[&_svg]:opacity-100` reveals the tick.
