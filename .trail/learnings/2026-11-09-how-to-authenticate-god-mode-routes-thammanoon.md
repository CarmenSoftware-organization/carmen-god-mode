---
title: How to authenticate god-mode routes in Playwright/E2E
author: Thammanoon
date: 2026-11-09
id: l-c59f275c
scope: repo
status: active
touches:
  - playwright.config.ts
  - e2e/platform-migrations.spec.ts
  - lib/session.ts
  - "e2e/login.ts#login"
  - "server/auth.ts#login"
  - "lib/session.ts#verifyPassword"
---

## Decided
To reach an authed god route in Playwright (see rsc-run-the-app: you must boot an authed route to catch RSC bugs), log in via the **shared-secret** form:

1. `page.goto("/login")`.
2. Click the shared-secret tab with `getByRole("tab", { name: /Shared secret/i })` — the tab is `<button role="tab">`, so `getByRole("button", …)` will **not** match it (explicit ARIA role wins over the implicit button role).
3. Fill `input[name="actor"]` (any name, recorded for audit) + `input[name="secret"]` = `process.env.GOD_MODE_PASSWORD`.
4. Submit → lands on `/schemas`.

`playwright.config.ts` loads `.env.local` into `process.env`, so `GOD_MODE_PASSWORD` is available in specs without extra wiring.

**Why:** When gateway login is enabled (`BACKEND_API_BASE_URL` set in `.env.local` — the current dev default), the **gateway** tab is active by default and the secret form is hidden until the shared-secret tab is clicked. A `getByRole("button", …)` selector silently finds nothing; the click (wrapped in `.catch()`) no-ops, the secret form never renders, and the login helper times out waiting for `input[name="secret"]`. This bit the `e2e/platform-migrations.spec.ts` login helper (fixed 2026-07-24, PR #14).

## Watch out
Reuse the `login()` helper in `e2e/platform-migrations.spec.ts` for any new god-mode E2E spec. Use it (not gateway login, which needs a real backend) — the secret path only needs `GOD_MODE_PASSWORD`. Auth is a shared-secret gate (`verifyPassword` in `lib/session.ts`), distinct from the gateway/platform-permission contract in carmen-backend-auth-api.

_From Claude Code's memory of this repo, last updated Jul 24._
