"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Pencil,
  Trash2,
  RotateCcw,
  Ban,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { batchDeleteHref, stageBatchSelection } from "@/lib/batch-selection";
import type { Cluster } from "@/lib/registry";
import { Tabs } from "@/components/ui/tabs";
import { Table, THead, TBody, TR, Th, Td } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type Tab = "active" | "deleted";

export function ClustersTable({
  clusters,
  system,
  softDeleteAction,
  restoreAction,
}: {
  clusters: Cluster[];
  system: string;
  softDeleteAction: (formData: FormData) => void;
  restoreAction: (formData: FormData) => void;
}) {
  const [tab, setTab] = useState<Tab>("active");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const active = clusters.filter((c) => c.deletedAt === null);
  const deleted = clusters.filter((c) => c.deletedAt !== null);
  const rows = tab === "active" ? active : deleted;

  const key = (c: Cluster) => JSON.stringify({ id: c.id });
  function switchTab(next: string) {
    setTab(next as Tab);
    setSelected(new Set());
  }
  function toggle(k: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }
  function toggleAll() {
    setSelected((prev) =>
      prev.size === rows.length
        ? new Set()
        : new Set(rows.map(key)),
    );
  }

  const selectedPks = [...selected].map((k) => JSON.parse(k) as { id: string });
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const batchDeleteHrefValue = batchDeleteHref(system, "tb_cluster");

  const tabs = [
    { id: "active" as const, label: "Active", count: active.length },
    { id: "deleted" as const, label: "Deleted", count: deleted.length },
  ];

  return (
    <div className="space-y-3">
      <Tabs items={tabs} active={tab} onChange={switchTab} />

      {/* Active tab: add + soft delete */}
      {tab === "active" && (
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/clusters/new">
            <Button variant="primary" size="sm">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add cluster
            </Button>
          </Link>
          {selected.size > 0 && (
            <form action={softDeleteAction}>
              <input type="hidden" name="pks" value={JSON.stringify(selectedPks)} />
              <Button variant="warning" size="sm" type="submit">
                <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                Soft delete {selected.size}
              </Button>
            </form>
          )}
        </div>
      )}

      {/* Deleted tab: restore + hard delete */}
      {tab === "deleted" && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <form action={restoreAction}>
            <input type="hidden" name="pks" value={JSON.stringify(selectedPks)} />
            <Button variant="success" size="sm" type="submit">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Restore {selected.size}
            </Button>
          </form>
          <Link href={batchDeleteHrefValue} onClick={() => stageBatchSelection(system, "tb_cluster", selectedPks)}>
            <Button variant="danger" size="sm">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Hard delete {selected.size}
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
            {tab === "active" ? (
              <Th className="text-right">Business Units</Th>
            ) : (
              <Th>Deleted at</Th>
            )}
            <Th className="w-28 text-right">Actions</Th>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5}>
                <EmptyState
                  icon="package"
                  title={tab === "active" ? "No clusters" : "No deleted clusters"}
                />
              </td>
            </tr>
          ) : (
            rows.map((c, i) => {
              const k = key(c);
              const isChecked = selected.has(k);
              const isDeleted = tab === "deleted";
              return (
                <TR
                  key={c.id}
                  className={cn(
                    isDeleted && "text-foreground-muted line-through",
                    isChecked && "bg-accent/5",
                  )}
                >
                  <Td className="w-10">
                    <Checkbox
                      aria-label={`Select row ${i + 1}`}
                      checked={isChecked}
                      onChange={() => toggle(k)}
                    />
                  </Td>
                  <Td className="font-mono text-xs">{c.code}</Td>
                  <Td>{c.name}</Td>
                  {tab === "active" ? (
                    <Td className="text-right tabular-nums">
                      {c.businessUnitCount}
                    </Td>
                  ) : (
                    <Td className="text-xs text-foreground-subtle">{c.deletedAt}</Td>
                  )}
                  <Td className="w-28 text-right">
                    {tab === "active" ? (
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/clusters/${encodeURIComponent(c.id)}/edit`}>
                          <Button variant="ghost" size="sm">
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="sr-only sm:not-sr-only">Edit</span>
                          </Button>
                        </Link>
                        <form action={softDeleteAction} className="inline">
                          <input
                            type="hidden"
                            name="pks"
                            value={JSON.stringify([{ id: c.id }])}
                          />
                          <Button variant="danger-ghost" size="sm" type="submit">
                            <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="sr-only sm:not-sr-only !whitespace-nowrap">Soft delete</span>
                          </Button>
                        </form>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <form action={restoreAction} className="inline">
                          <input
                            type="hidden"
                            name="pks"
                            value={JSON.stringify([{ id: c.id }])}
                          />
                          <Button variant="ghost" size="sm" type="submit">
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="sr-only sm:not-sr-only">Restore</span>
                          </Button>
                        </form>
                        <Link
                          href={`/${encodeURIComponent(system)}/tb_cluster/delete?pk=${encodeURIComponent(JSON.stringify({ id: c.id }))}`}
                        >
                          <Button variant="danger-ghost" size="sm">
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="sr-only sm:not-sr-only !whitespace-nowrap">Hard delete</span>
                          </Button>
                        </Link>
                      </div>
                    )}
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
