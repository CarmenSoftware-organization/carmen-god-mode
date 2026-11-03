import type { UnsafeQueryOptions } from "postgres";
import { withTransaction } from "@/lib/db";
import { writeAudit, ensureAuditTable } from "@/lib/audit";
import { currentActor } from "@/lib/write";

export type SqlResult =
  | { kind: "read"; columns: string[]; rows: Record<string, unknown>[]; rowCount: number }
  | { kind: "write-preview"; affected: number }
  | { kind: "write-applied"; affected: number };

// postgres.js types omit `simple`; false forces the extended protocol, which
// rejects multi-statement strings (see node_modules/postgres/src/index.js:124).
const ONE_STATEMENT = { simple: false } as unknown as UnsafeQueryOptions;

const ROLLBACK = Symbol("rollback-preview");

export async function runRead(schema: string, statement: string): Promise<SqlResult> {
  return withTransaction(schema, async (tx) => {
    const rows = (await tx.unsafe(statement, [], ONE_STATEMENT)) as unknown as Record<string, unknown>[];
    const columns = rows.length ? Object.keys(rows[0]) : [];
    return { kind: "read", columns, rows: rows.slice(0, 500), rowCount: rows.length };
  }, { readOnly: true });
}

export async function previewWrite(schema: string, statement: string): Promise<SqlResult> {
  let affected = 0;
  try {
    await withTransaction(schema, async (tx) => {
      const res = (await tx.unsafe(statement, [], ONE_STATEMENT)) as unknown as { count?: number } & unknown[];
      affected = typeof res?.count === "number" ? res.count : Array.isArray(res) ? res.length : 0;
      throw ROLLBACK; // force rollback — preview only
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
  return { kind: "write-preview", affected };
}

export async function applyWrite(schema: string, statement: string): Promise<SqlResult> {
  const actor = await currentActor();
  await ensureAuditTable();
  return withTransaction(schema, async (tx) => {
    const res = (await tx.unsafe(statement, [], ONE_STATEMENT)) as unknown as { count?: number } & unknown[];
    const affected = typeof res?.count === "number" ? res.count : Array.isArray(res) ? res.length : 0;
    await writeAudit(tx, { actor, schemaName: schema, tableName: null, operation: "RAW_SQL", pk: null, oldValues: null, newValues: null, statement });
    return { kind: "write-applied", affected };
  });
}
