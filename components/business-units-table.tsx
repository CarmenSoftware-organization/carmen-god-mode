"use client";
import { useState } from "react";
import Link from "next/link";
import { Trash2, ArrowRight, AlertTriangle, Search, Link2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { batchDeleteHref, stageBatchSelection } from "@/lib/batch-selection";
import type { BusinessUnit } from "@/lib/registry";
import { Table, THead, TBody, TR, Th, Td } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { SortableTh, compareCells, nextSort, type SortState } from "@/components/ui/sortable-th";

type SortKey = "code" | "name" | "cluster" | "method" | "status" | "schema";

export function BusinessUnitsTable({
  bus,
  system,
  poolMismatchIds = [],
  sharedSchemas = {},
  clusters = {},
}: {
  bus: BusinessUnit[];
  system: string;
  /** Business units whose registry pool is not the database this instance is connected to. */
  poolMismatchIds?: string[];
  /** Tenant schema → codes of the live business units that use it. */
  sharedSchemas?: Record<string, string[]>;
  /** Cluster id → display info, for the parent-cluster column. */
  clusters?: Record<string, { code: string; name: string; deleted: boolean }>;
}) {
  const mismatched = new Set(poolMismatchIds);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortState<SortKey>>(null);
  const [query, setQuery] = useState("");
  const [cleanupOnly, setCleanupOnly] = useState(false);

  function sortValue(b: BusinessUnit, key: SortKey): string | null {
    switch (key) {
      case "code": return b.code;
      case "name": return b.name;
      case "cluster": return b.clusterId ? clusters[b.clusterId]?.code ?? null : null;
      case "method": return b.calculationMethod ?? null;
      case "status": return b.deletedAt ? "Deleted" : b.isActive ? "Active" : "Inactive";
      case "schema": return b.tenantSchema;
    }
  }
  // Filter first, then sort. Unsorted keeps the server order (by code).
  const q = query.trim().toLowerCase();
  const visible = bus.filter((b) => {
    if (cleanupOnly && !b.deletedAt && b.isActive) return false;
    if (!q) return true;
    return [b.code, b.name, b.tenantSchema ?? ""].some((v) => v.toLowerCase().includes(q));
  });
  const rows = sort
    ? [...visible].sort((a, b) => compareCells(sortValue(a, sort.key), sortValue(b, sort.key), sort.dir))
    : visible;
  const onSort = (key: SortKey) => setSort((prev) => nextSort(prev, key));

  function buKey(b: BusinessUnit): string {
    return JSON.stringify({ id: b.id });
  }
  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  // Only rows the filter shows can be acted on: a selection hidden by the filter
  // must never ride along into a bulk delete the operator can't see.
  const visibleKeys = rows.map(buKey);
  const effective = visibleKeys.filter((k) => selected.has(k));
  const allSelected = visibleKeys.length > 0 && effective.length === visibleKeys.length;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(visibleKeys));
  }

  const selectedPks = effective.map((k) => JSON.parse(k) as { id: string });
  const batchHref = batchDeleteHref(system, "tb_business_unit");

  return (
    <div className="space-y-3">
      {/* Filter */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-subtle" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Filter business units"
            placeholder="Filter by code, name or schema"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground-muted">
          <Checkbox checked={cleanupOnly} onChange={(e) => setCleanupOnly(e.target.checked)} />
          Deleted or inactive only
        </label>
        {(q || cleanupOnly) && (
          <span className="text-sm text-foreground-muted tabular-nums">
            {rows.length} of {bus.length} shown
          </span>
        )}
      </div>

      {/* Bulk action bar */}
      {effective.length > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-danger-border bg-danger-subtle px-3 py-2">
          <span className="text-sm font-medium text-danger-subtle-foreground">
            {effective.length} selected
          </span>
          <Link href={batchHref} onClick={() => stageBatchSelection(system, "tb_business_unit", selectedPks)}>
            <Button variant="danger" size="sm">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Review {effective.length} for deletion
            </Button>
          </Link>
          <span className="text-sm text-danger-subtle-foreground">
            Nothing is deleted yet: the next page lists every row this removes.
          </span>
        </div>
      )}

      <Table>
        <THead>
          <TR>
            <Th className="w-10">
              <Checkbox
                aria-label="Select all"
                checked={allSelected}
                onChange={toggleAll}
              />
            </Th>
            <SortableTh label="Code" sortKey="code" sort={sort} onSort={onSort} className="w-36" />
            <SortableTh label="Name" sortKey="name" sort={sort} onSort={onSort} />
            <SortableTh label="Cluster" sortKey="cluster" sort={sort} onSort={onSort} className="w-32" />
            <SortableTh label="Method" sortKey="method" sort={sort} onSort={onSort} className="w-52" title="Inventory costing method (FIFO or average cost)" />
            <SortableTh label="Active" sortKey="status" sort={sort} onSort={onSort} className="w-24" />
            <SortableTh label="Tenant schema" sortKey="schema" sort={sort} onSort={onSort} title="The Postgres schema that holds this business unit's inventory data" />
            <Th className="text-right">Actions</Th>
          </TR>
        </THead>
        <TBody>
          {bus.length === 0 ? (
            <tr>
              <td colSpan={8}>
                <EmptyState icon="package" title="No business units" />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={8}>
                <EmptyState icon="package" title="No business units match the filter" />
                <div className="-mt-6 flex justify-center pb-6">
                  <Button variant="outline" size="sm" onClick={() => { setQuery(""); setCleanupOnly(false); }}>
                    Clear filter
                  </Button>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((b, i) => {
              const key = buKey(b);
              const isChecked = selected.has(key);
              // A soft-deleted BU whose schema a live BU still uses: deleting it removes
              // only the registry config; the schema drop is refused downstream.
              const sharedWith = b.deletedAt && b.tenantSchema ? sharedSchemas[b.tenantSchema] ?? [] : [];
              const buOnly = sharedWith.length > 0;
              // Other live BUs on the same schema, shown inline so it never hides behind a hover.
              const sharesWith = b.tenantSchema
                ? (sharedSchemas[b.tenantSchema] ?? []).filter((c) => c !== b.code)
                : [];
              return (
                <TR key={b.id} className={cn(isChecked && "bg-accent/5", b.deletedAt && "text-foreground-muted")}>
                  <Td className="w-10">
                    <Checkbox
                      aria-label={`Select row ${i + 1}`}
                      checked={isChecked}
                      onChange={() => toggle(key)}
                    />
                  </Td>
                  <Td className="font-mono text-xs">{b.code}</Td>
                  <Td>{b.name}</Td>
                  <Td className="font-mono text-xs">
                    {b.clusterId && clusters[b.clusterId] ? (
                      <Link
                        href={`/clusters/${encodeURIComponent(b.clusterId)}/edit`}
                        title={clusters[b.clusterId].name}
                        className={cn("hover:underline", clusters[b.clusterId].deleted && "line-through text-foreground-muted")}
                      >
                        {clusters[b.clusterId].code}
                      </Link>
                    ) : (
                      <span className="text-foreground-subtle">{b.clusterId ? "unknown" : "none"}</span>
                    )}
                  </Td>
                  <Td className="font-mono text-xs uppercase">
                    {b.calculationMethod ?? <span className="normal-case text-foreground-subtle">none</span>}
                  </Td>
                  <Td>
                    {b.deletedAt ? (
                      <Badge variant="danger">Deleted</Badge>
                    ) : b.isActive ? (
                      // The normal case stays quiet so Deleted/Inactive stand out.
                      <span className="text-foreground-muted">Active</span>
                    ) : (
                      <Badge variant="neutral">Inactive</Badge>
                    )}
                  </Td>
                  <Td className="max-w-none whitespace-normal font-mono text-xs">
                    {b.tenantSchema ?? (
                      <span className="text-foreground-subtle">none</span>
                    )}
                    {mismatched.has(b.id) && (
                      <Badge variant="warning" className="ml-2 font-sans">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        other database
                      </Badge>
                    )}
                    {sharesWith.length > 0 && (
                      <div className="mt-1">
                        <Badge variant="info" className="font-sans">
                          <Link2 className="h-3 w-3" aria-hidden="true" />
                          shared with {sharesWith.join(", ")}
                        </Badge>
                      </div>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                      {b.tenantSchema && (
                        <Link href={`/${encodeURIComponent(b.tenantSchema)}/tables`} aria-label={`Open ${b.tenantSchema}`}>
                          <Button variant="ghost" size="sm">
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                            Open
                          </Button>
                        </Link>
                      )}
                      <Link
                        href={`/${encodeURIComponent(system)}/tb_business_unit/delete?pk=${encodeURIComponent(JSON.stringify({ id: b.id }))}`}
                        aria-label={`${buOnly ? "Delete config only for" : "Delete BU"} ${b.code}`}
                      >
                        <Button variant={isChecked ? "danger-ghost" : "danger-quiet"} size="sm">
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {buOnly ? "Delete config only" : "Delete BU"}
                        </Button>
                      </Link>
                    </div>
                  </Td>
                </TR>
              );
            })
          )}
        </TBody>
      </Table>
    </div>
  );
}
