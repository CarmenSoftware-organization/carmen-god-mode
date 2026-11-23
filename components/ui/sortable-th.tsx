"use client";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Th } from "@/components/ui/table";
import { cn } from "@/lib/cn";

export type SortDir = "asc" | "desc";
export type SortState<K extends string> = { key: K; dir: SortDir } | null;

/** Next state when a header is clicked: a new column starts ascending, the same column flips. */
export function nextSort<K extends string>(prev: SortState<K>, key: K): SortState<K> {
  return prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" };
}

/**
 * Compare two cell values for sorting: empty values (null/"") always go last,
 * strings compare case-insensitively with numeric runs ("T2" < "T10").
 */
export function compareCells(a: string | null | undefined, b: string | null | undefined, dir: SortDir): number {
  const ea = a == null || a === "";
  const eb = b == null || b === "";
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
  const c = a!.localeCompare(b!, undefined, { numeric: true, sensitivity: "base" });
  return dir === "asc" ? c : -c;
}

export function SortableTh<K extends string>({
  label, sortKey, sort, onSort, className, title,
}: {
  label: string;
  /** Plain-language explanation of the column, shown on hover. */
  title?: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  className?: string;
}) {
  const active = sort?.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <Th
      className={className}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={title}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className={cn("h-3 w-3", !active && "opacity-70")} aria-hidden="true" />
      </button>
    </Th>
  );
}
