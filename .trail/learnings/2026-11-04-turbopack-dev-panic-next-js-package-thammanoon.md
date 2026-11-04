---
title: "Turbopack dev panic 'Next.js package not found' = stale .next/dev/cache/turbopack, not code"
author: Thammanoon
date: 2026-11-04
branch: chore/trail-learning-turbopack-stale-cache
cost: { minutes: 3, tokens: 81005 }
id: l-ae1bdf5d
scope: repo
status: active
src: agent
---

## Decided
Fix is to delete `.next/dev/cache/turbopack` (the persistent Turbopack dev cache) and restart `bun run dev`. No code or config change. A warm restart with the regenerated cache stays clean.

## Tried and ruled out
- Missing/wrong `next` install: `node_modules/next` was present at 16.2.9.
- Workspace-root misdetection: no lockfile in any parent dir.
- Code/build problem: `bun run build` passes; only `next dev` panics.

## Watch out
- Symptom: `FATAL: An unexpected Turbopack error ... Failed to write app endpoint /login/page ... Caused by: Next.js package not found` (in `get_next_server_import_map`, triggered from `hmr_version_state`), and the report says "Next.js version: 0.0.0". The browser then reloads in a loop (~170 loads in 8s; `GET /login 200` spam in the terminal, React DevTools banner spam in `.next/dev/logs/next-development.log`).
- The cache is keyed by Turbopack version only (`.next/dev/cache/turbopack/<hash>`), so the same Next version keeps reusing an old cache (here 1.5GB, created months earlier). Likely invalidated by a `node_modules` reinstall; that cause was not proven.
- It reproduces only with a browser attached (HMR), not with curl. Repro used Playwright headless on a spare port (`next dev -p 3399`).
