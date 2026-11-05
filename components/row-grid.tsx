"use client";
import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { batchDeleteHref, stageBatchSelection } from "@/lib/batch-selection";
import type { RowPage } from "@/lib/rows";
import { Table, THead, TBody, TR, Th, Td } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export function RowGrid({ schema, table, page }: { schema: string; table: string; page: RowPage }) {
  const readOnly = page.primaryKey.length === 0;
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function pkKey(row: Record<string, unknown>): string {
    return JSON.stringify(pk(row, page.primaryKey));
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
      prev.size === page.rows.length
        ? new Set()
        : new Set(page.rows.map(pkKey)),
    );
  }

  const selectedPks = [...selected].map((k) => JSON.parse(k) as Record<string, unknown>);
  const batchHref = batchDeleteHref(schema, table);
  const allSelected = page.rows.length > 0 && selected.size === page.rows.length;

  return (
    <div className="space-y-3">
      {/* Read-only notice */}
      {readOnly && (
        <div className="flex items-center gap-2 rounded-md border border-warning-border bg-warning-subtle px-3 py-2 text-sm text-warning-subtle-foreground">
          No primary key detected. This table is read-only in god mode.
        </div>
      )}

      {/* Bulk action bar */}
      {!readOnly && selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-danger-border bg-danger-subtle px-3 py-2">
          <span className="text-sm font-medium text-danger-subtle-foreground">
            {selected.size} selected
          </span>
          <Link href={batchHref} onClick={() => stageBatchSelection(schema, table, selectedPks)}>
            <Button variant="danger" size="sm">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete {selected.size}
            </Button>
          </Link>
        </div>
      )}

      {/* Table */}
      <Table>
        <THead>
          <TR>
            {!readOnly && (
              <Th className="w-10">
                <Checkbox
                  aria-label="Select all rows"
                  checked={allSelected}
                  onChange={toggleAll}
                />
              </Th>
            )}
            {page.columns.map((c) => (
              <Th key={c.name} className="font-mono">
                {c.name}
              </Th>
            ))}
            {!readOnly && <Th className="w-24 text-right">Actions</Th>}
          </TR>
        </THead>
        <TBody>
          {page.rows.length === 0 ? (
            <tr>
              <td
                colSpan={
                  page.columns.length + (readOnly ? 0 : 2)
                }
              >
                <EmptyState
                  icon="table"
                  title="No rows"
                  hint="This table is currently empty."
                />
              </td>
            </tr>
          ) : (
            page.rows.map((row, i) => {
              const key = readOnly ? String(i) : pkKey(row);
              const isChecked = selected.has(key);
              return (
                <TR
                  key={i}
                  className={cn(isChecked && "bg-accent/5")}
                >
                  {!readOnly && (
                    <Td className="w-10">
                      <Checkbox
                        aria-label={`Select row ${i + 1}`}
                        checked={isChecked}
                        onChange={() => toggle(key)}
                      />
                    </Td>
                  )}
                  {page.columns.map((c) => (
                    <Td key={c.name} className="font-mono text-xs">
                      {format(row[c.name])}
                    </Td>
                  ))}
                  {!readOnly && (
                    <Td className="w-24 text-right">
                      <Link
                        href={`/${encodeURIComponent(schema)}/${encodeURIComponent(table)}/edit?pk=${encodeURIComponent(JSON.stringify(pk(row, page.primaryKey)))}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-link hover:text-link-hover"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="sr-only sm:not-sr-only">edit</span>
                      </Link>
                      {" "}
                      <Link
                        href={`/${encodeURIComponent(schema)}/${encodeURIComponent(table)}/delete?pk=${encodeURIComponent(JSON.stringify(pk(row, page.primaryKey)))}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-danger hover:text-danger-hover"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="sr-only sm:not-sr-only">delete</span>
                      </Link>
                    </Td>
                  )}
                </TR>
              );
            })
          )}
        </TBody>
      </Table>

      {/* Pagination */}
      {page.nextCursor && (
        <div className="flex items-center">
          <Link
            href={`/${encodeURIComponent(schema)}/${encodeURIComponent(table)}?cursor=${encodeURIComponent(page.nextCursor)}`}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            Next page
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      )}
    </div>
  );
}

function pk(row: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, row[k]]));
}

function format(v: unknown): string {
  if (v === null || v === undefined) return "\u2205";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
