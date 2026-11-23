// components/confirm-delete.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import type { BlastRadius } from "@/lib/cascade";
import { useOperationStream } from "@/components/use-operation-stream";
import { OperationProgress } from "@/components/operation-progress";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, THead, TBody, TR, Th, Td } from "@/components/ui/table";
import { SealConfirm } from "@/components/seal-confirm";
import { cn } from "@/lib/cn";

/** "tb_user_tb_business_unit" → "user ↔ business unit links"; "tb_application_role" → "application role". */
export function humanizeTable(table: string): string {
  const parts = table.replace(/^tb_/, "").split("_tb_").map((p) => p.replace(/_/g, " "));
  return parts.length > 1 ? `${parts.join(" ↔ ")} links` : parts[0];
}

type Scope = "config" | "data";

export function ConfirmDelete({
  schema,
  table,
  pkJson,
  radius,
  isBusinessUnit,
  tenantSchema,
  orphanSchemas,
  poolWarning,
  sharedWarning,
  requiredPhrase,
}: {
  schema: string;
  table: string;
  pkJson: string;
  radius: BlastRadius;
  isBusinessUnit: boolean;
  tenantSchema: string | null;
  orphanSchemas?: string[];
  /** Set when the registry points this target at a database other than the connected one. */
  poolWarning?: string | null;
  /** Set when a live business unit outside this delete still uses the schema. */
  sharedWarning?: string | null;
  requiredPhrase: string;
}) {
  const { state, start } = useOperationStream();
  const dropBlocked = !!poolWarning || !!sharedWarning;
  // BU delete on a schema another live BU uses: only the registry config goes; the
  // schema is kept. Pool mismatch takes precedence (the schema isn't on this host).
  const keepsSharedSchema = isBusinessUnit && !!tenantSchema && !!sharedWarning && !poolWarning;
  // A BU with its own schema forces an explicit choice between keeping and wiping
  // its data; that fork is the decision that matters, so it is never a default.
  const offersFork = isBusinessUnit && !!tenantSchema && !keepsSharedSchema;
  const [scope, setScope] = useState<Scope | null>(offersFork && dropBlocked ? "config" : null);
  // Cluster deletes keep the opt-in checkbox for their orphan schemas.
  const [dropOrphans, setDropOrphans] = useState(false);

  const parsed = JSON.parse(pkJson);
  const pks: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : [parsed];
  const running = state.phase === "running";
  const dropsBuSchema = offersFork && scope === "data" && !dropBlocked;
  // The server demands the schema name, not DELETE, for a single BU delete that also
  // drops its schema (app/api/ops/cascade-delete). The page only knows the base
  // phrase, so the switch has to happen here or that delete is always refused.
  const phrase = dropsBuSchema ? tenantSchema! : requiredPhrase;
  const needsChoice = offersFork && scope === null;
  const cancelHref = isBusinessUnit ? "/schemas" : `/${encodeURIComponent(schema)}/${encodeURIComponent(table)}`;

  function submit() {
    start("/api/ops/cascade-delete", {
      schema,
      table,
      pks,
      dropSchema: offersFork ? dropsBuSchema : dropOrphans && !dropBlocked,
      confirm: phrase,
    });
  }

  return (
    <div className="max-w-2xl">
      <div className="overflow-hidden rounded-md border border-danger-border bg-surface">
        <div className="flex items-center gap-2 border-b border-border bg-danger-subtle px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-danger-subtle-foreground">Armed</span>
          <span aria-hidden="true" className="text-danger-border">/</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-danger-subtle-foreground">Irreversible</span>
        </div>

        <div className="space-y-4 p-4">
          <Alert variant="danger" title={`Permanently deletes ${radius.rows.length} row(s) across ${radius.byTable.length} table(s).`}>
            {radius.truncated && (
              <p>
                Blast radius hit the configured cap. Execution will be refused until you
                narrow it or raise the caps.
              </p>
            )}
          </Alert>

          {/* Plain-language impact first; the raw table list sits behind a disclosure. */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">What this removes</p>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {radius.byTable.map((b) => (
                <li key={`${b.schema}.${b.table}`} className="flex items-baseline gap-2">
                  <span className="min-w-8 text-right font-semibold tabular-nums">{b.count}</span>
                  <span className="text-foreground-muted">{humanizeTable(b.table)}</span>
                </li>
              ))}
              {dropsBuSchema && (
                <li className="flex items-baseline gap-2 sm:col-span-2">
                  <span className="min-w-8 text-right font-semibold text-danger-subtle-foreground">all</span>
                  <span className="text-danger-subtle-foreground">
                    tables and inventory data in schema <code className="font-mono text-xs">{tenantSchema}</code>
                  </span>
                </li>
              )}
            </ul>
            <details className="group rounded-md border border-border">
              <summary className="cursor-pointer select-none px-3 py-2 text-sm text-foreground-muted hover:text-foreground">
                Database tables ({radius.byTable.length})
              </summary>
              <div className="max-h-72 overflow-y-auto border-t border-border">
                <Table>
                  <THead>
                    <TR>
                      <Th>Table</Th>
                      <Th className="text-right">Rows</Th>
                    </TR>
                  </THead>
                  <TBody>
                    {radius.byTable.map((b) => (
                      <TR key={`${b.schema}.${b.table}`}>
                        <Td className="font-mono text-xs">
                          {b.schema}.{b.table}
                        </Td>
                        <Td className="text-right tabular-nums">{b.count}</Td>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            </details>
          </div>

          {/* Registry points somewhere this instance is not connected to */}
          {poolWarning && (
            <Alert variant="danger" title="Tenant schema lives on another database">
              {poolWarning} Dropping the schema is disabled; deleting the registry row is still allowed.
            </Alert>
          )}

          {/* Another live business unit still uses this schema */}
          {keepsSharedSchema && (
            <Alert variant="info" title="Deletes this business unit's configuration only">
              Schema &quot;{tenantSchema}&quot; and its data are kept. {sharedWarning}
            </Alert>
          )}
          {sharedWarning && !keepsSharedSchema && (
            <Alert variant="danger" title="Tenant schema is shared">
              {sharedWarning} Dropping the schema is disabled; deleting the registry row is still allowed.
            </Alert>
          )}

          {/* The decision that matters for a business unit: keep or wipe its data. */}
          {offersFork && (
            <fieldset className="space-y-2" disabled={running}>
              <legend className="mb-2 text-sm font-semibold text-foreground">
                What should this delete remove?
              </legend>
              <ScopeOption
                name="delete-scope"
                checked={scope === "config"}
                onSelect={() => setScope("config")}
                title="Configuration only"
                tone="neutral"
              >
                Removes the business unit and its registry rows listed above. Schema{" "}
                <code className="font-mono text-xs">{tenantSchema}</code> and its inventory data stay in the database.
              </ScopeOption>
              <ScopeOption
                name="delete-scope"
                checked={scope === "data"}
                onSelect={() => setScope("data")}
                disabled={dropBlocked}
                title="Configuration and all tenant data"
                tone="danger"
              >
                Also runs <code className="font-mono text-xs">DROP SCHEMA &quot;{tenantSchema}&quot; CASCADE</code>:
                every table and row of this business unit&apos;s inventory is wiped.
                {dropBlocked && " Unavailable here: see the warning above."}
              </ScopeOption>
            </fieldset>
          )}

          {/* Cluster delete: orphaned tenant schemas */}
          {orphanSchemas && orphanSchemas.length > 0 && (
            <div className="space-y-2">
              <label className="flex items-start gap-3 rounded-md border border-warning-border bg-warning-subtle p-3 text-sm text-warning-subtle-foreground aria-disabled:opacity-60" aria-disabled={dropBlocked}>
                <Checkbox
                  checked={dropOrphans && !dropBlocked}
                  disabled={dropBlocked}
                  onChange={(e) => setDropOrphans(e.target.checked)}
                />
                <span>
                  Also <strong>DROP {orphanSchemas.length} tenant schema(s) CASCADE</strong>:{" "}
                  <code className="rounded bg-black/10 px-1 font-mono text-xs">
                    {orphanSchemas.join(", ")}
                  </code>{" "}
                  (wipes each tenant database)
                </span>
              </label>
              <p className="text-xs text-foreground-muted">
                The confirmation phrase below stays DELETE.
              </p>
            </div>
          )}

          {offersFork && (
            <p className="text-sm text-foreground-muted">
              {needsChoice
                ? "Choose what to remove before confirming."
                : dropsBuSchema
                  ? <>Wiping data needs the schema name: type <code className="font-mono text-xs">{tenantSchema}</code> instead of DELETE.</>
                  : "Configuration only: type DELETE."}
            </p>
          )}

          <SealConfirm
            requiredPhrase={phrase}
            onStamp={submit}
            disabled={radius.truncated || needsChoice}
            pending={running}
            label="Confirm and permanently delete"
          />

          {!running && state.phase !== "done" && (
            <Link href={cancelHref} className="block">
              <Button variant="outline" className="w-full">Cancel, keep everything</Button>
            </Link>
          )}

          <OperationProgress state={state} rolledBackOnError />
        </div>
      </div>
    </div>
  );
}

function ScopeOption({
  name, checked, onSelect, disabled = false, title, tone, children,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
  title: string;
  tone: "neutral" | "danger";
  children: React.ReactNode;
}) {
  return (
    <label
      aria-disabled={disabled || undefined}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors",
        "aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
        checked
          ? tone === "danger"
            ? "border-danger bg-danger-subtle"
            : "border-accent bg-surface-muted"
          : "border-border hover:bg-surface-hover",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className={cn("mt-0.5 h-4 w-4 shrink-0", tone === "danger" ? "accent-danger" : "accent-accent")}
      />
      <span className="space-y-0.5">
        <span className={cn("block font-semibold", tone === "danger" ? "text-danger-subtle-foreground" : "text-foreground")}>
          {title}
        </span>
        <span className="block text-foreground-muted">{children}</span>
      </span>
    </label>
  );
}
