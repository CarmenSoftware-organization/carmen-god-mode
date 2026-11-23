import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BusinessUnitsTable } from "@/components/business-units-table";
import { listBusinessUnits, listSelectableSchemas, loadSchemaUsage } from "@/lib/registry";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionLabel } from "@/components/ui/page-header";
import { isProtectedSchema } from "@/lib/drop-schema";
import { loadAllPools, poolMatches, parseConnectionIdentity } from "@/lib/db-pool";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function SchemasPage() {
  const [bus, sel, pools, usage] = await Promise.all([
    listBusinessUnits(), listSelectableSchemas(), loadAllPools(), loadSchemaUsage(),
  ]);
  // pools === null on a registry that predates the pool split: nothing to flag.
  const connected = parseConnectionIdentity(env().databaseUrl);
  const poolMismatchIds = (pools ?? [])
    .filter((p) => p.dbSchema && !poolMatches(p.pool, connected))
    .map((p) => p.id);
  return (
    <div>
      <PageHeader
        rubric="Overview"
        title="Schemas"
        lede="Pick a target schema to inspect its tables and rows, or manage business units."
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
          />
        </section>

        {/* All schemas */}
        <section>
          <SectionLabel>All schemas</SectionLabel>
          <div className="overflow-hidden rounded-md border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Schema</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Actions</span>
            </div>
            <ul>
              {/* Schemas a live BU uses are already listed in the Business units table above. */}
              {sel.allSchemas.filter((s) => isProtectedSchema(s) || !usage.has(s)).map((s) => (
                <li
                  key={s}
                  className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5 transition-colors last:border-0 hover:bg-surface-hover"
                >
                  <Link
                    href={`/${encodeURIComponent(s)}/tables`}
                    className="flex min-w-0 flex-1 items-center gap-2"
                  >
                    <span className="truncate font-mono text-[13px] text-foreground">{s}</span>
                  </Link>
                  <div className="flex shrink-0 items-center gap-4">
                    {isProtectedSchema(s) ? (
                      <span className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
                        Protected
                      </span>
                    ) : (
                      <Link
                        href={`/schemas/${encodeURIComponent(s)}/delete`}
                        className="text-xs font-semibold uppercase tracking-wider text-danger transition-colors hover:text-danger-hover"
                      >
                        Delete
                      </Link>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-foreground-subtle" aria-hidden="true" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
