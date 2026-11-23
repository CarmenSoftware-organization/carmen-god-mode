import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { computeBlastRadius } from "@/lib/cascade";
import { resolveTenantSchema, resolveTenantSchemasForCluster, sharedSchemaReason } from "@/lib/registry";
import { loadPoolsForBusinessUnits, loadPoolsForCluster, tenantDropBlockReason } from "@/lib/db-pool";
import { requiredPhrase } from "@/lib/delete-confirm";
import { ConfirmDelete } from "@/components/confirm-delete";
import { SchemaBanner } from "@/components/schema-banner";

export const dynamic = "force-dynamic";

export default async function DeletePage({
  params, searchParams,
}: { params: Promise<{ schema: string; table: string }>; searchParams: Promise<{ pk?: string }> }) {
  const { schema, table } = await params;
  const { pk: pkParam } = await searchParams;
  if (!pkParam) notFound();
  const pk = JSON.parse(pkParam) as Record<string, unknown>;
  const isBusinessUnit = schema === env().systemSchemaName && table === "tb_business_unit";
  const tenantSchema = isBusinessUnit ? await resolveTenantSchema(String(pk.id)) : null;
  const isCluster = schema === env().systemSchemaName && table === "tb_cluster";
  const orphanSchemas = isCluster ? await resolveTenantSchemasForCluster(String(pk.id)) : undefined;
  const poolWarning = isBusinessUnit
    ? tenantDropBlockReason(await loadPoolsForBusinessUnits([String(pk.id)]))
    : isCluster
    ? tenantDropBlockReason(await loadPoolsForCluster(String(pk.id)))
    : null;
  const sharedWarning = isBusinessUnit
    ? await sharedSchemaReason(tenantSchema ? [tenantSchema] : [], { businessUnitId: String(pk.id) })
    : isCluster
    ? await sharedSchemaReason(orphanSchemas ?? [], { clusterId: String(pk.id) })
    : null;
  const radius = await computeBlastRadius(schema, table, pk);
  return (
    <div className="space-y-4">
      <SchemaBanner schema={schema} />
      {isBusinessUnit ? (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Delete business unit</h1>
          <p className="mt-1 font-mono text-xs text-foreground-muted">
            {schema}.{table}{tenantSchema ? ` · tenant schema ${tenantSchema}` : ""}
          </p>
        </div>
      ) : (
        <h1 className="text-2xl font-semibold tracking-tight">
          Delete from <span className="font-mono">{schema}.{table}</span>
        </h1>
      )}
      <ConfirmDelete schema={schema} table={table} pkJson={JSON.stringify(pk)} radius={radius}
        isBusinessUnit={isBusinessUnit} tenantSchema={tenantSchema}
        orphanSchemas={orphanSchemas} poolWarning={poolWarning} sharedWarning={sharedWarning}
        requiredPhrase={requiredPhrase({ isBusinessUnit, dropSchema: null })} />
    </div>
  );
}
