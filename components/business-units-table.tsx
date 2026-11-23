"use client";
import { useState } from "react";
import Link from "next/link";
import { Trash2, ArrowRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import { batchDeleteHref, stageBatchSelection } from "@/lib/batch-selection";
import type { BusinessUnit } from "@/lib/registry";
import { Table, THead, TBody, TR, Th, Td } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  // Unsorted keeps the server order (by code).
  const rows = sort
    ? [...bus].sort((a, b) => compareCells(sortValue(a, sort.key), sortValue(b, sort.key), sort.dir))
    : bus;
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
  function toggleAll() {
    setSelected((prev) =>
      prev.size === bus.length
        ? new Set()
        : new Set(bus.map(buKey)),
    );
  }

  const selectedPks = [...selected].map((k) => JSON.parse(k) as { id: string });
  const batchHref = batchDeleteHref(system, "tb_business_unit");
  const allSelected = bus.length > 0 && selected.size === bus.length;

  return (
    <div className="space-y-3">
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-danger-border bg-danger-subtle px-3 py-2">
          <span className="text-sm font-medium text-danger-subtle-foreground">
            {selected.size} selected
          </span>
          <Link href={batchHref} onClick={() => stageBatchSelection(system, "tb_business_unit", selectedPks)}>
            <Button variant="danger" size="sm">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete {selected.size}
            </Button>
          </Link>
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
            <SortableTh label="Code" sortKey="code" sort={sort} onSort={onSort} />
            <SortableTh label="Name" sortKey="name" sort={sort} onSort={onSort} />
            <SortableTh label="Cluster" sortKey="cluster" sort={sort} onSort={onSort} />
            <SortableTh label="Method" sortKey="method" sort={sort} onSort={onSort} />
            <SortableTh label="Active" sortKey="status" sort={sort} onSort={onSort} />
            <SortableTh label="Tenant schema" sortKey="schema" sort={sort} onSort={onSort} />
            <Th className="w-28 text-right">Actions</Th>
          </TR>
        </THead>
        <TBody>
          {bus.length === 0 ? (
            <tr>
              <td colSpan={8}>
                <EmptyState icon="package" title="No business units" />
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
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="neutral">Inactive</Badge>
                    )}
                  </Td>
                  <Td className="font-mono text-xs">
                    {b.tenantSchema ?? (
                      <span className="text-foreground-subtle">none</span>
                    )}
                    {mismatched.has(b.id) && (
                      <Badge variant="warning" className="ml-2 font-sans">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        other database
                      </Badge>
                    )}
                  </Td>
                  <Td className="w-28 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {b.tenantSchema && (
                        <Link href={`/${encodeURIComponent(b.tenantSchema)}/tables`}>
                          <Button variant="ghost" size="sm">
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="sr-only sm:not-sr-only">Open</span>
                          </Button>
                        </Link>
                      )}
                      <Link
                        href={`/${encodeURIComponent(system)}/tb_business_unit/delete?pk=${encodeURIComponent(JSON.stringify({ id: b.id }))}`}
                        title={buOnly ? `Schema ${b.tenantSchema} is shared with ${sharedWith.join(", ")} and will be kept` : undefined}
                      >
                        <Button variant="danger-ghost" size="sm">
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="sr-only sm:not-sr-only">{buOnly ? "Delete BU only" : "Delete"}</span>
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
