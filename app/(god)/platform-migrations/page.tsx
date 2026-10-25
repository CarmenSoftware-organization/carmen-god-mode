import { PlatformMigrations } from "@/components/platform-migrations";
import { visibleCatalog, resolveScriptInfo, type ScriptInfo } from "@/lib/platform-migrations";
import { env } from "@/lib/env";
import { listBusinessUnits } from "@/lib/registry";
import { listSchemaNames } from "@/lib/introspect";
import { listTenantFiles, targetDbInfo, readPackageScripts } from "@/lib/platform-package";

export const dynamic = "force-dynamic";

export default async function PlatformMigrationsPage() {
  const [bus, tenantFiles, schemas, scripts] = await Promise.all([
    listBusinessUnits(), listTenantFiles(), listSchemaNames(), readPackageScripts(),
  ]);
  const buCodes = bus.filter((b) => b.isActive).map((b) => b.code);
  const target = targetDbInfo();
  const catalog = visibleCatalog(env().allowDangerOps);
  const scriptInfo: Record<string, ScriptInfo> = Object.fromEntries(
    catalog.map((op) => [op.id, resolveScriptInfo(op, scripts)]),
  );
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-base font-semibold tracking-tight">Platform migrations</h1>
        <p className="max-w-2xl text-sm text-foreground-muted">
          Runs migration scripts of <code className="font-mono">@repo/prisma-shared-schema-backstage</code>{" "}
          against the database this instance manages, by spawning the package&apos;s own commands. Pick
          the target schema below. Output streams live.
        </p>
      </div>
      <PlatformMigrations
        target={target} catalog={catalog} buCodes={buCodes} tenantFiles={tenantFiles}
        schemas={schemas} defaultSchema={target.schema} scriptInfo={scriptInfo}
      />
    </div>
  );
}
