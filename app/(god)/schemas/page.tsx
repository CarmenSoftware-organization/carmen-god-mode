import Link from "next/link";
import { ChevronRight, Lock, Trash2 } from "lucide-react";
import { BusinessUnitsTable } from "@/components/business-units-table";
import { listBusinessUnits, listClusters, listSelectableSchemas, loadSchemaUsage } from "@/lib/registry";
import { schemaFootprints } from "@/lib/introspect";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, SectionLabel } from "@/components/ui/page-header";
import { isProtectedSchema } from "@/lib/drop-schema";
import { loadAllPools, poolMatches, parseConnectionIdentity } from "@/lib/db-pool";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function SchemasPage() {
  const [bus, sel, pools, usage, clusterRows] = await Promise.all([
    listBusinessUnits(), listSelectableSchemas(), loadAllPools(), loadSchemaUsage(), listClusters(),
  ]);
  const clusters = Object.fromEntries(
    clusterRows.map((c) => [c.id, { code: c.code, name: c.name, deleted: c.deletedAt !== null }]),
  );
  // pools === null on a registry that predates the pool split: nothing to flag.
  const otherSchemas = sel.allSchemas.filter((s) => !isProtectedSchema(s) && !usage.has(s));
  const footprints = await schemaFootprints(otherSchemas);
  const connected = parseConnectionIdentity(env().databaseUrl);
  const poolMismatchIds = (pools ?? [])
    .filter((p) => p.dbSchema && !poolMatches(p.pool, connected))
    .map((p) => p.id);
  return (
    <div>
      <PageHeader
        rubric="Overview"
        title="Schemas"
        lede="Open a schema to browse and edit its tables. Deleting a business unit removes its registry config; dropping its tenant schema, which holds its inventory data, is a separate opt-in on the next page."
      />

      <div className="space-y-8">
        {/* System link */}
        <section>
          <SectionLabel>System</SectionLabel>
          <Link href={`/${encodeURIComponent(sel.system)}/tables`}>
            <Button variant="outline" size="sm">
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              Manage {sel.system} (registry, users, business units)
            </Button>
          </Link>
        </section>

        {/* Business units */}
        <section>
          <SectionLabel>Business units</SectionLabel>
          <BusinessUnitsTable
            bus={bus}
            system={sel.system}
            poolMismatchIds={poolMismatchIds}
            sharedSchemas={Object.fromEntries(usage)}
            clusters={clusters}
          />
        </section>

        {/* Unprotected schemas a live BU doesn't use (those are in the table above). */}
        <SchemaList
          label="Other schemas"
          hint="No business unit uses these schemas. Dropping one deletes all of its data."
          schemas={otherSchemas}
          detail={(s) => {
            const f = footprints.get(s);
            if (!f) return null;
            return f.tables === 0 ? "empty" : `${f.tables} tables · ${f.size}`;
          }}
          action={(s) => (
            <Link href={`/schemas/${encodeURIComponent(s)}/delete`} aria-label={`Drop schema ${s}`}>
              <Button variant="danger-quiet" size="sm">
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Drop schema
              </Button>
            </Link>
          )}
        />

        {/* System, public and PROTECTED_SCHEMAS: never droppable from here. */}
        <SchemaList
          label="Protected schemas"
          hint="The system schema, public, and anything listed in PROTECTED_SCHEMAS. You can browse them; they can't be dropped here."
          schemas={sel.allSchemas.filter(isProtectedSchema)}
          action={() => (
            <Badge variant="neutral">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Protected
            </Badge>
          )}
        />
      </div>
    </div>
  );
}

function SchemaList({
  label, hint, schemas, detail, action,
}: {
  label: string;
  hint?: string;
  schemas: string[];
  /** Optional muted summary shown before the action (e.g. table count and size). */
  detail?: (schema: string) => string | null;
  action: (schema: string) => React.ReactNode;
}) {
  return (
    <section>
      <SectionLabel className={hint ? "mb-1" : undefined}>{label}</SectionLabel>
      {hint && <p className="mb-3 text-sm text-foreground-muted">{hint}</p>}
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Schema</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Actions</span>
        </div>
        {schemas.length === 0 ? (
          <p className="px-4 py-2.5 text-sm text-foreground-subtle">None</p>
        ) : (
          <ul>
            {schemas.map((s) => (
              <li
                key={s}
                className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5 transition-colors last:border-0 hover:bg-surface-hover"
              >
                <Link href={`/${encodeURIComponent(s)}/tables`} className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate font-mono text-xs text-foreground">{s}</span>
                </Link>
                <div className="flex shrink-0 items-center gap-4">
                  {detail?.(s) && (
                    <span className="text-xs tabular-nums text-foreground-muted">{detail(s)}</span>
                  )}
                  {action(s)}
                  <ChevronRight className="h-3.5 w-3.5 text-foreground-subtle" aria-hidden="true" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
