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

export function BusinessUnitsTable({
  bus,
  system,
  poolMismatchIds = [],
}: {
  bus: BusinessUnit[];
  system: string;
  /** Business units whose registry pool is not the database this instance is connected to. */
  poolMismatchIds?: string[];
}) {
  const mismatched = new Set(poolMismatchIds);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
            <Th>Code</Th>
            <Th>Name</Th>
            <Th>Active</Th>
            <Th>Tenant schema</Th>
            <Th className="w-28 text-right">Actions</Th>
          </TR>
        </THead>
        <TBody>
          {bus.length === 0 ? (
            <tr>
              <td colSpan={6}>
                <EmptyState icon="package" title="No business units" />
              </td>
            </tr>
          ) : (
            bus.map((b, i) => {
              const key = buKey(b);
              const isChecked = selected.has(key);
              return (
                <TR key={b.id} className={cn(isChecked && "bg-accent/5")}>
                  <Td className="w-10">
                    <Checkbox
                      aria-label={`Select row ${i + 1}`}
                      checked={isChecked}
                      onChange={() => toggle(key)}
                    />
                  </Td>
                  <Td className="font-mono text-xs">{b.code}</Td>
                  <Td>{b.name}</Td>
                  <Td>
                    {b.isActive ? (
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
                      >
                        <Button variant="danger-ghost" size="sm">
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="sr-only sm:not-sr-only">Delete</span>
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
