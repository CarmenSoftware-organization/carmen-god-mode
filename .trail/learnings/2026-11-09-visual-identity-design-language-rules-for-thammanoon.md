---
title: Visual identity / design-language rules for the god-mode admin UI (use when adding or…
author: Thammanoon
date: 2026-11-09
id: l-9dc8f36c
scope: repo
status: active
touches:
  - docs/superpowers/specs/2026-07-06-platform-aligned-hybrid-redesign-design.md
  - docs/superpowers/plans/2026-07-06-platform-aligned-redesign.md
  - app/globals.css
  - app/layout.tsx
  - components/sidebar.tsx
  - components/nav-link.tsx
  - lib/use-theme.ts
  - components/theme-toggle.tsx
  - components/target-bar.tsx
  - lib/db-target.ts
---

## Decided
God Mode UI design language = **carmen-platform-aligned hybrid** (as of 2026-07-06). This **RETIRES the prior "The Register of Carmen" (Ledger)** serif/oyster-paper/wax-seal identity for the chrome, re-skinning god-mode to look like a sibling of `../carmen-platform` — so operators recognise them as one product family. Full redesign on branch `feat/platform-aligned-redesign` (9 commits `1a57867..0fedaed`, presentation-only, 189 tests). Spec: `docs/superpowers/specs/2026-07-06-platform-aligned-hybrid-redesign-design.md`; plan: `docs/superpowers/plans/2026-07-06-platform-aligned-redesign.md`. Keep new UI consistent with THIS:

- **Palette (token NAMES unchanged in `app/globals.css` `:root`/`.dark` via `@theme inline`; only values changed to platform HSL):** background cool-gray `hsl(226 20% 98%)`, **white** card surface `hsl(0 0% 100%)` (deliberate — matches platform cards, AA-safe), ink `hsl(226 30% 10%)`; dark anchored on platform `.dark` (`hsl(224 71% 4%)` bg). Primary ACTION = **blue** `--accent` `hsl(221 61% 48%)` (dark `217 65% 55%`). State = semantic `--danger`/`--warning`/`--success`/`--info` (platform destructive/warning/success/info). `--danger` darkened to `hsl(0 84% 48%)` (light) for WCAG AA on white text — reads as a MORE vivid alarm red, intentional. `--warning-foreground` is dark text (AA deviation from platform's white). radius `--radius: 0.375rem` (6px).
…

## Watch out
derive colours/type from the tokens above (they're the platform's); spend distinctiveness ONLY on the live-target bar + confirm ceremony, keep everything else quiet, platform-consistent, and shadcn-plain. See carmen-backend-auth-api for the db-target/auth context.

_From Claude Code's memory of this repo, last updated Jul 6._
