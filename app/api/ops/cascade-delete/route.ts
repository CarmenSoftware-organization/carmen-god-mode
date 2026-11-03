import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import { requireAuth } from "@/lib/session";
import { readJsonObject, isOptionalString, isOptionalBoolean, isPlainObject } from "@/lib/request-body";
import { executeCascade, executeCascadeMany } from "@/lib/cascade";
import { requiredPhrase, phraseMatches } from "@/lib/delete-confirm";
import { resolveTenantSchema, resolveTenantSchemasForCluster } from "@/lib/registry";
import { loadPoolsForBusinessUnits, loadPoolsForCluster, tenantDropBlockReason } from "@/lib/db-pool";
import { streamOperation } from "@/lib/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  schema: string; table: string;
  pks: Record<string, unknown>[]; dropSchema?: boolean; confirm: string;
};

export async function POST(request: Request): Promise<Response> {
  try {
    await requireAuth();
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Request body must be a JSON object" }, { status: 400 });
  const { schema, table, pks, dropSchema, confirm } = body as Body;
  if (!Array.isArray(pks) || pks.length === 0) {
    return Response.json({ error: "No rows selected" }, { status: 400 });
  }
  if (
    typeof schema !== "string" || typeof table !== "string" || !pks.every(isPlainObject) ||
    !isOptionalString(confirm) || !isOptionalBoolean(dropSchema)
  ) {
    return Response.json({ error: "Invalid field types in request body" }, { status: 400 });
  }

  const isBusinessUnit = schema === env().systemSchemaName && table === "tb_business_unit";
  const isCluster = schema === env().systemSchemaName && table === "tb_cluster";
  const isSingle = pks.length === 1;

  // Only single-row delete may drop tenant schemas (batch never drops).
  let dropSchemas: string[] = [];
  if (isSingle && dropSchema) {
    if (isBusinessUnit) { const s = await resolveTenantSchema(String(pks[0].id)); if (s) dropSchemas = [s]; }
    else if (isCluster) { dropSchemas = await resolveTenantSchemasForCluster(String(pks[0].id)); }
  }

  // BU + single + drop → phrase is the schema name; everything else → "DELETE".
  const phrase = requiredPhrase({
    isBusinessUnit,
    dropSchema: isBusinessUnit && isSingle ? (dropSchemas[0] ?? null) : null,
  });
  if (!phraseMatches(confirm ?? "", phrase)) {
    return Response.json({ error: `Confirmation text must equal "${phrase}"` }, { status: 400 });
  }

  // A tenant schema is resolved by name, but it only lives on this connection when the
  // registry points the business unit at this host. Refuse the drop otherwise.
  if (dropSchemas.length > 0) {
    const pools = isBusinessUnit
      ? await loadPoolsForBusinessUnits([String(pks[0].id)])
      : await loadPoolsForCluster(String(pks[0].id));
    const blocked = tenantDropBlockReason(pools);
    if (blocked) return Response.json({ error: blocked }, { status: 409 });
  }

  const redirect = isBusinessUnit
    ? "/schemas"
    : isCluster
    ? "/clusters"
    : `/${encodeURIComponent(schema)}/${encodeURIComponent(table)}`;

  return streamOperation(async (onProgress) => {
    let summary: string;
    if (isSingle) {
      const res = await executeCascade(schema, table, pks[0], { dropTenantSchemas: dropSchemas, onProgress });
      summary = `Deleted ${res.deleted} row(s)` +
        (res.droppedSchemas.length ? `, dropped ${res.droppedSchemas.length} schema(s)` : "");
    } else {
      const res = await executeCascadeMany(schema, table, pks, { onProgress });
      summary = `Deleted ${res.deleted} row(s)`;
    }
    // mirror the prior server-action revalidation (best-effort; the delete already committed)
    try {
      if (isBusinessUnit) revalidatePath("/schemas");
      if (isCluster) revalidatePath("/clusters");
      revalidatePath(`/${schema}/${table}`);
    } catch { /* revalidation is best-effort; the delete already committed */ }
    return { summary, redirect };
  });
}
