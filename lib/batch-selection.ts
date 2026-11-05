/**
 * Hand a batch-delete selection from a table to the delete-batch page without
 * putting it in the URL. A query string of N primary keys outgrows Node's 16KB
 * header cap (Next.js repeats the URL in its RSC navigation headers), so at
 * ~100 UUID rows the navigation died with 431. sessionStorage is per-tab, so the
 * key only needs to name the target table.
 */
type Pk = Record<string, unknown>;
type Stored = { pks: Pk[]; savedAt: number };

const MAX_AGE_MS = 30 * 60 * 1000;

function storageKey(schema: string, table: string): string {
  return `godmode:batch-delete:${schema}.${table}`;
}

export function batchDeleteHref(schema: string, table: string): string {
  return `/${encodeURIComponent(schema)}/${encodeURIComponent(table)}/delete-batch`;
}

export function stageBatchSelection(schema: string, table: string, pks: Pk[]): void {
  try {
    const value: Stored = { pks, savedAt: Date.now() };
    sessionStorage.setItem(storageKey(schema, table), JSON.stringify(value));
  } catch {
    /* storage unavailable: the delete-batch page reports "no selection" */
  }
}

/** The staged selection for this table, or null when absent, stale or malformed. */
export function readBatchSelection(schema: string, table: string): Pk[] | null {
  try {
    const raw = sessionStorage.getItem(storageKey(schema, table));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (typeof parsed.savedAt !== "number" || Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    if (!Array.isArray(parsed.pks) || parsed.pks.length === 0) return null;
    return parsed.pks;
  } catch {
    return null;
  }
}
