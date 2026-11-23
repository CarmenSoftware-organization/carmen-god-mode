import Link from "next/link";
import { Filter } from "lucide-react";
import { listAuditPage, type Operation } from "@/lib/audit";
import { Table, THead, TBody, TR, Th, Td } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AuditChanges } from "@/components/audit-changes";

export const dynamic = "force-dynamic";
const OPS: Operation[] = ["INSERT", "UPDATE", "DELETE", "CASCADE_DELETE", "CREATE_SCHEMA", "DROP_SCHEMA", "RAW_SQL"];

// Irreversible operations carry the seal mark in the record.
const SEALED: ReadonlySet<Operation> = new Set(["DELETE", "CASCADE_DELETE", "DROP_SCHEMA"]);

// Map operation types to badge variants (status never by color alone: text carries it).
function opVariant(op: Operation) {
  switch (op) {
    case "DELETE":
    case "CASCADE_DELETE":
    case "DROP_SCHEMA":
      return "danger" as const;
    case "INSERT":
    case "CREATE_SCHEMA":
      return "success" as const;
    case "UPDATE":
    case "RAW_SQL":
    default:
      return "neutral" as const;
  }
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ schema?: string; table?: string; operation?: string; cursor?: string }> }) {
  const sp = await searchParams;
  const { entries, nextCursor } = await listAuditPage({
    schema: sp.schema,
    table: sp.table,
    operation: sp.operation as Operation | undefined,
    cursor: sp.cursor,
    limit: 50,
  });

  // Next-page link keeps the active filters and swaps in the new cursor.
  const nextParams = new URLSearchParams();
  if (sp.schema) nextParams.set("schema", sp.schema);
  if (sp.table) nextParams.set("table", sp.table);
  if (sp.operation) nextParams.set("operation", sp.operation);
  if (nextCursor) nextParams.set("cursor", nextCursor);
  const nextHref = `/audit?${nextParams.toString()}`;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Audit</p>
        <h1 className="text-2xl font-medium tracking-tight">Audit log</h1>
      </div>

      {/* Filter form */}
      <form className="flex flex-wrap items-center gap-2">
        <Input
          name="schema"
          defaultValue={sp.schema ?? ""}
          placeholder="schema"
          className="max-w-[160px]"
        />
        <Input
          name="table"
          defaultValue={sp.table ?? ""}
          placeholder="table"
          className="max-w-[160px]"
        />
        <select
          name="operation"
          defaultValue={sp.operation ?? ""}
          className="h-9 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <option value="">any op</option>
          {OPS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <Button type="submit" variant="primary" size="md">
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          Filter
        </Button>
      </form>

      {/* Entries */}
      <Table>
        <THead>
          <TR>
            <Th>At</Th>
            <Th>Actor</Th>
            <Th>Target</Th>
            <Th>Op</Th>
            <Th>PK</Th>
            <Th>Changes</Th>
          </TR>
        </THead>
        <TBody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={6}>
                <EmptyState
                  icon="search"
                  title="No audit entries"
                  hint="No entries match the current filters."
                />
              </td>
            </tr>
          ) : (
            entries.map((e) => (
              <TR key={e.id} className="align-top">
                <Td className="whitespace-nowrap font-mono text-xs text-foreground-muted">
                  {e.at}
                </Td>
                <Td className="text-xs">{e.actor}</Td>
                <Td className="font-mono text-xs">
                  {e.schemaName}
                  {e.tableName ? `.${e.tableName}` : ""}
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-1.5">
                    {SEALED.has(e.operation) && (
                      <span
                        role="img"
                        aria-label="sealed"
                        title="Sealed — irreversible"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] border-seal text-[9px] leading-none text-danger-subtle-foreground"
                      >
                        ●
                      </span>
                    )}
                    <Badge variant={opVariant(e.operation)}>{e.operation}</Badge>
                  </span>
                </Td>
                <Td className="font-mono text-xs text-foreground-muted">
                  {e.pk ? JSON.stringify(e.pk) : ""}
                </Td>
                <Td>
                  <AuditChanges entry={e} />
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      {/* Pagination — forward-only, matches the rows browser */}
      {nextCursor && (
        <div className="flex items-center">
          <Link
            href={nextHref}
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
