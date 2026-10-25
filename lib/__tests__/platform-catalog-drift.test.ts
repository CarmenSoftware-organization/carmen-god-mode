import { expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { CATALOG } from "@/lib/platform-migrations";
import { DEFAULT_REL } from "@/lib/platform-package";

// Import DEFAULT_REL to keep path in sync; module import has no env() side effect.
function readRealScripts(): Record<string, string> | null {
  const dir = process.env.BACKSTAGE_PACKAGE_DIR ?? path.resolve(process.cwd(), DEFAULT_REL);
  try {
    const raw = fs.readFileSync(path.join(dir, "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { scripts?: Record<string, string> };
    return parsed.scripts ?? null;
  } catch {
    return null;
  }
}

const scripts = readRealScripts();

// Skip when the backend package isn't present (e.g. CI without the sibling repo).
test.skipIf(!scripts)(
  "every script-kind catalog op maps to a real package script",
  () => {
    // Sanity: we actually read a populated scripts map, so the assertions below
    // are not vacuously true against an empty/misread object.
    expect(scripts!["db:seed.permission"]).toBeTypeOf("string");

    const missing = CATALOG.filter((o) => o.kind === "script" && scripts![o.run] === undefined);
    expect(missing.map((o) => `${o.id} → ${o.run}`)).toEqual([]);
  },
);

// Reverse direction: catch a new upstream operator-facing script that nobody wired into the
// catalog. Every script in the package must be accounted for — either it is in CATALOG, or it
// is here with a reason. A new upstream script therefore fails this suite by default, which is
// the point: the old regex only knew the namespaces that existed when it was written, so
// db:backfill.* appeared upstream and slipped past it in silence.
//
// Script names are compared whole rather than parsed, because this package has no single
// namespace convention: db:seed.x uses a dot, db:tenant-views:apply and db:migrate:reset use
// a colon. There is nothing reliable to split on.
const UNSURFACED: Record<string, string> = {
  build: "not a database operation",
  test: "not a database operation",
  "db:generate": "local prisma codegen; nothing to run against a live database",
  "db:migrate": "prisma migrate dev — interactive, authors migrations; db:deploy is the god-mode path",
  "db:migrate.database-pool":
    "one-off backfill; upstream documents the scan/--apply path as dead once migration " +
    "20260813010000_database_pool_drop_db_connection removed the column it reads",
  "db:backfill.subscription":
    "scan-only until --apply; surfacing it needs an apply toggle in the catalog and UI first",
  "db:backfill.bu-license":
    "scan-only until --apply; surfacing it needs an apply toggle in the catalog and UI first",
};

test.skipIf(!scripts)(
  "every package script is either in the catalog or explicitly unsurfaced",
  () => {
    const catalogRuns = new Set(CATALOG.map((o) => o.run));
    const unaccounted = Object.keys(scripts!)
      .filter((name) => !catalogRuns.has(name) && UNSURFACED[name] === undefined)
      .sort();
    expect(
      unaccounted,
      "new upstream script(s): add each to CATALOG in lib/platform-migrations.ts, " +
        "or to UNSURFACED above with the reason it stays hidden",
    ).toEqual([]);
  },
);

// Keeps the allowlist honest: an entry for a script upstream has since deleted is dead weight
// that nobody dares remove later, because its reason no longer maps to anything readable.
test.skipIf(!scripts)("every unsurfaced entry still names a real package script", () => {
  const stale = Object.keys(UNSURFACED)
    .filter((name) => scripts![name] === undefined)
    .sort();
  expect(stale, "allowlist entries for scripts that no longer exist upstream — delete them").toEqual([]);
});
