---
title: "God Mode's visual rules live in DESIGN.md; the primary is terracotta, not blue"
author: Thammanoon
date: 2026-11-23
branch: main
cost: { minutes: 12, tokens: 194510 }
id: l-5d1069bf
scope: repo
status: active
replaces: l-9dc8f36c
src: agent
touches:
  - PRODUCT.md
  - DESIGN.md
  - app/globals.css
  - app/layout.tsx
  - components/target-bar.tsx
  - components/seal-confirm.tsx
---

## Decided
- God Mode's visual system is now recorded in DESIGN.md at the repo root, with a sidecar in .impeccable/design.json. It was written on 2026-11-23 from the live code and the user chose the qualitative language:
  - North Star: "The Control Room"
  - component feel: "tactile & deliberate"
  - primary colour name: "Fired Terracotta"
- Still true: the look follows the carmen-backstage family (Inter, cool gray, sidebar, zebra tables, lucide). Only two elements are allowed to be loud: the live-target bar and the type-to-arm / press-and-hold confirm ceremony. The Ledger identity is retired.

## Watch out
- The 2026-07-06 hybrid spec and the older learning say the primary is blue hsl(221 61% 48%), the radius is 6px and the mono font is IBM Plex Mono. All three are out of date. Later commits on the same day (7184472, ff3a31f) swapped in the shadcn warm oklch theme through an adapter layer.
- Blue now survives only as the --info state family.

In the code:
- app/globals.css: :root sets --primary: oklch(0.58 0.172 36.44); --radius: 0.75rem (12px base, buttons/inputs 10px).
- app/layout.tsx: next/font loads Inter + JetBrains Mono.
- components/target-bar.tsx, components/seal-confirm.tsx: the two loud elements.
