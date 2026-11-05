---
title: "Batch-delete selection must not ride in the URL: ~100 UUID pks overflow Node's 16KB header cap (431)"
author: Thammanoon
date: 2026-11-05
branch: fix/batch-delete-url-length
cost: { minutes: 10, tokens: 207933 }
id: l-3187b333
scope: repo
status: active
src: agent
touches:
  - lib/batch-selection.ts
  - server/batch-delete.ts
  - components/batch-delete-loader.tsx
  - "app/(god)/[schema]/[table]/delete-batch/page.tsx"
  - components/clusters-table.tsx
---

## Decided
- Bulk "Delete N" / "Hard delete N" links (components/clusters-table.tsx, business-units-table.tsx, row-grid.tsx) now stage the selection in sessionStorage via lib/batch-selection.ts and link to a bare `/<schema>/<table>/delete-batch`. The page renders components/batch-delete-loader.tsx, which reads the selection and calls the server action server/batch-delete.ts `previewBatchDelete` (pks go in the POST body) to get the blast radius.
- Chosen over in-memory server staging (lost on restart/HMR, breaks multi-instance) and an inline modal (bigger UI change).

## Tried and ruled out
- Blaming cascade/DB: the 51-row confirm page rendered fine; the failure was before any server code ran.

## Watch out
- The URL is only ~6.2KB at 100 rows, and a plain GET passes. It's the Next.js client navigation that 431s: the RSC request repeats the URL in `Next-Url` and `Next-Router-State-Tree`, which adds up to more than 16KB. Reproduce with curl using `RSC: 1` + those headers, not a plain GET.
- Selection is per-tab and expires after 30 min. A middle-click/new tab shows "No selection to delete".
