import { getSql } from "@/lib/db";
import { env } from "@/lib/env";
import { qualified } from "@/lib/sql-guard";
import { listSchemaNames } from "@/lib/introspect";

export type BusinessUnit = { id: string; code: string; name: string; clusterId: string | null; isActive: boolean; tenantSchema: string | null;
  /** ISO timestamp of the soft delete; null/absent for a live BU. */
  deletedAt?: string | null };

export async function listBusinessUnits(): Promise<BusinessUnit[]> {
  const reg = qualified(env().systemSchemaName, "tb_business_unit");
  try {
    const rows = (await getSql().unsafe(
      `SELECT id::text, cluster_id::text AS cluster_id, code, name,
              COALESCE(is_active, true) AS is_active,
              db_schema AS tenant_schema,
              -- via jsonb so a registry without the column still reads (as null)
              to_jsonb(b) ->> 'deleted_at' AS deleted_at
       FROM ${reg} b ORDER BY code`,
    )) as unknown as {
      id: string; code: string; name: string; cluster_id: string | null;
      is_active: boolean; tenant_schema: string | null; deleted_at: string | null;
    }[];
    return rows.map((r) => ({
      id: r.id, code: r.code, name: r.name, clusterId: r.cluster_id ?? null,
      isActive: r.is_active, tenantSchema: r.tenant_schema ?? null,
      deletedAt: r.deleted_at ?? null,
    }));
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "42P01") return [];
    throw err;
  }
}

/**
 * SQL fragments over a `tb_business_unit b` row. Read through `to_jsonb(b)` so a
 * registry missing `deleted_at` (no soft delete → every row is live, which errs
 * toward protecting schemas) or `code` (falls back to the id) still queries.
 */
const LIVE_BU = `(to_jsonb(b) ->> 'deleted_at') IS NULL`;
const LIVE_BU_CODE = `COALESCE(to_jsonb(b) ->> 'code', b.id::text)`;

/**
 * Tenant schema → codes of the live (not soft-deleted) business units whose
 * `db_schema` points at it. Pass `schema` to look up just that one. A schema in
 * this map holds a live tenant's data and must not be dropped on its own.
 */
export async function loadSchemaUsage(schema?: string): Promise<Map<string, string[]>> {
  const reg = qualified(env().systemSchemaName, "tb_business_unit");
  const params: string[] = schema === undefined ? [] : [schema];
  try {
    const rows = (await getSql().unsafe(
      `SELECT db_schema, ${LIVE_BU_CODE} AS code FROM ${reg} b
       WHERE db_schema IS NOT NULL AND ${LIVE_BU}
       ${schema === undefined ? "" : "AND db_schema = $1"}
       ORDER BY 2`,
      params,
    )) as unknown as { db_schema: string; code: string }[];
    const usage = new Map<string, string[]>();
    for (const r of rows) usage.set(r.db_schema, [...(usage.get(r.db_schema) ?? []), r.code]);
    return usage;
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "42P01") return new Map();
    throw err;
  }
}

export async function resolveTenantSchema(businessUnitId: string): Promise<string | null> {
  const reg = qualified(env().systemSchemaName, "tb_business_unit");
  const rows = await getSql().unsafe(
    `SELECT db_schema AS tenant_schema FROM ${reg} WHERE id = $1::uuid`,
    [businessUnitId],
  );
  return rows[0]?.tenant_schema ?? null;
}

export async function listSelectableSchemas(): Promise<{ system: string; tenantSchemas: string[]; allSchemas: string[] }> {
  const system = env().systemSchemaName;
  const bus = await listBusinessUnits();
  const tenantSchemas = [...new Set(bus.map((b) => b.tenantSchema).filter((s): s is string => !!s))].sort();
  const allSchemas = await listSchemaNames();
  return { system, tenantSchemas, allSchemas };
}

export type Cluster = { id: string; code: string; name: string; deletedAt: string | null; businessUnitCount: number };

export async function listClusters(): Promise<Cluster[]> {
  const cl = qualified(env().systemSchemaName, "tb_cluster");
  const bu = qualified(env().systemSchemaName, "tb_business_unit");
  try {
    const rows = (await getSql().unsafe(
      `SELECT c.id::text, c.code, c.name, c.deleted_at::text AS deleted_at,
              (SELECT count(*) FROM ${bu} b WHERE b.cluster_id = c.id)::int AS business_unit_count
       FROM ${cl} c ORDER BY c.code`,
    )) as unknown as {
      id: string; code: string; name: string;
      deleted_at: string | null; business_unit_count: number;
    }[];
    return rows.map((r) => ({
      id: r.id, code: r.code, name: r.name,
      deletedAt: r.deleted_at ?? null, businessUnitCount: r.business_unit_count,
    }));
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "42P01") return [];
    throw err;
  }
}

/**
 * Why dropping `schemas` alongside a delete would hit a tenant that survives it,
 * or `null` if no such tenant exists. A survivor is a live (not soft-deleted)
 * business unit that uses one of the schemas and is not part of the delete:
 * for a BU delete, any other BU; for a cluster delete, any BU outside that cluster.
 */
export async function sharedSchemaReason(
  schemas: string[],
  deleting: { businessUnitId: string } | { clusterId: string },
): Promise<string | null> {
  if (schemas.length === 0) return null;
  const bu = qualified(env().systemSchemaName, "tb_business_unit");
  const [col, id] = "businessUnitId" in deleting
    ? ["id", deleting.businessUnitId]
    : ["cluster_id", deleting.clusterId];
  const arr = `{${schemas.map((s) => `"${s.replace(/["\\]/g, "\\$&")}"`).join(",")}}`;
  const rows = (await getSql().unsafe(
    `SELECT db_schema, ${LIVE_BU_CODE} AS code FROM ${bu} b
     WHERE db_schema = ANY($1::text[]) AND ${LIVE_BU}
       AND ${col} IS DISTINCT FROM $2::uuid
     ORDER BY 1, 2`,
    [arr, id],
  )) as unknown as { db_schema: string; code: string }[];
  if (rows.length === 0) return null;
  const list = rows.map((r) => `${r.db_schema} (${r.code})`).join(", ");
  return `Schema still used by a live business unit that is not being deleted: ${list}.`;
}

export async function resolveTenantSchemasForCluster(clusterId: string): Promise<string[]> {
  const bu = qualified(env().systemSchemaName, "tb_business_unit");
  const rows = (await getSql().unsafe(
    `SELECT DISTINCT db_schema AS tenant_schema
     FROM ${bu} WHERE cluster_id = $1::uuid AND db_schema IS NOT NULL`,
    [clusterId],
  )) as unknown as { tenant_schema: string }[];
  return rows.map((r) => r.tenant_schema);
}
