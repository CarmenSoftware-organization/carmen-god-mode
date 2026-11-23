import { withTransaction } from "@/lib/db";
import { ident } from "@/lib/sql-guard";
import { env } from "@/lib/env";
import { writeAudit, ensureAuditTable } from "@/lib/audit";
import { currentActor } from "@/lib/write";
import type { OnProgress } from "@/lib/progress";
import { loadSchemaUsage } from "@/lib/registry";

/**
 * The system schema is this console's own backbone — the registry, auth, and
 * business-unit tables it depends on. Dropping it would brick the tool and the
 * platform, so it is always refused.
 */
export function isSystemSchema(schema: string): boolean {
  return schema === env().systemSchemaName;
}

/**
 * Human-readable reason a schema is protected from dropping, or `null` if it may
 * be dropped. Protected: the system schema, and Postgres' default `public`
 * schema (dropping it breaks extensions, default privileges, and search_path).
 */
export function protectedReason(schema: string): string | null {
  if (isSystemSchema(schema)) {
    return "the system schema — the registry, auth, and business-unit tables this console depends on";
  }
  if (schema === "public") {
    return 'the database’s default "public" schema';
  }
  return null;
}

export function isProtectedSchema(schema: string): boolean {
  return protectedReason(schema) !== null;
}

/**
 * Human-readable reason a schema may not be dropped because a live business
 * unit still points at it, or `null` if none does. Removing such a tenant goes
 * through the business-unit delete, which carries the pool guard.
 */
export async function inUseReason(schema: string): Promise<string | null> {
  const codes = (await loadSchemaUsage(schema)).get(schema) ?? [];
  if (codes.length === 0) return null;
  return `in use by business unit ${codes.join(", ")} — delete the business unit instead`;
}

/**
 * Permanently `DROP SCHEMA <schema> CASCADE` and record a DROP_SCHEMA audit
 * entry in the same transaction. Refuses the system schema (fail-closed, before
 * any DB work). Presentation code must still gate on a typed-phrase +
 * press-and-hold confirmation; this is the committing primitive underneath.
 */
export async function executeDropSchema(
  schema: string,
  opts: { onProgress?: OnProgress } = {},
): Promise<{ droppedSchema: string }> {
  if (isProtectedSchema(schema)) {
    throw new Error(`Refusing to drop the protected schema "${schema}".`);
  }
  const inUse = await inUseReason(schema);
  if (inUse) {
    throw new Error(`Refusing to drop schema "${schema}": ${inUse}.`);
  }
  const actor = await currentActor();
  opts.onProgress?.({ type: "total", total: 1 });
  await ensureAuditTable();
  return withTransaction(null, async (tx) => {
    opts.onProgress?.({ type: "step", label: `Dropping schema ${schema}…`, done: 0 });
    await tx.unsafe(`DROP SCHEMA ${ident(schema)} CASCADE`);
    await writeAudit(tx, {
      actor,
      schemaName: schema,
      tableName: null,
      operation: "DROP_SCHEMA",
      pk: null,
      oldValues: null,
      newValues: null,
      statement: `DROP SCHEMA ${ident(schema)} CASCADE`,
    });
    opts.onProgress?.({ type: "step", label: `Dropped schema ${schema}`, done: 1 });
    return { droppedSchema: schema };
  });
}
