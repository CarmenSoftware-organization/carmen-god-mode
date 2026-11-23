// components/confirm-delete.tsx
"use client";
import { useState } from "react";
import type { BlastRadius } from "@/lib/cascade";
import { useOperationStream } from "@/components/use-operation-stream";
import { OperationProgress } from "@/components/operation-progress";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, THead, TBody, TR, Th, Td } from "@/components/ui/table";
import { SealConfirm } from "@/components/seal-confirm";

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
  const [dropSchema, setDropSchema] = useState(false);

  const parsed = JSON.parse(pkJson);
  const pks: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : [parsed];
  const running = state.phase === "running";
  const dropBlocked = !!poolWarning || !!sharedWarning;
  // BU delete on a schema another live BU uses: only the registry config goes; the
  // schema is kept. Pool mismatch takes precedence (the schema isn't on this host).
  const keepsSharedSchema = isBusinessUnit && !!tenantSchema && !!sharedWarning && !poolWarning;

  function submit() {
    start("/api/ops/cascade-delete", {
      schema,
      table,
      pks,
      dropSchema: dropSchema && !dropBlocked,
      confirm: requiredPhrase,
    });
  }

  return (
    <div className="max-w-2xl">
      <div className="overflow-hidden rounded-md border border-danger-border bg-surface">
        <div className="flex items-center gap-2 border-b border-border bg-danger-subtle px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-danger">Armed</span>
          <span aria-hidden="true" className="text-danger-border">/</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-danger-subtle-foreground">Irreversible</span>
        </div>

        <div className="space-y-4 p-4">
      {/* Blast radius warning */}
      <Alert variant="danger" title={`Permanently deletes ${radius.rows.length} row(s) across ${radius.byTable.length} table(s). Max depth ${radius.maxDepth}.`}>
        {radius.truncated && (
          <p>
            Blast radius hit the configured cap. Execution will be refused until you
            narrow it or raise the caps.
          </p>
        )}
      </Alert>

      {/* Blast radius summary table */}
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

      {/* Registry points somewhere this instance is not connected to */}
      {poolWarning && (
        <Alert variant="danger" title="Tenant schema lives on another database">
          {poolWarning} Dropping the schema is disabled; deleting the registry row is still allowed.
        </Alert>
      )}

      {/* Another live business unit still uses this schema */}
      {keepsSharedSchema && (
        <Alert variant="info" title="Deletes this business unit's registry config only">
          Schema &quot;{tenantSchema}&quot; is kept. {sharedWarning}
        </Alert>
      )}
      {sharedWarning && !keepsSharedSchema && (
        <Alert variant="danger" title="Tenant schema is shared">
          {sharedWarning} Dropping the schema is disabled; deleting the registry row is still allowed.
        </Alert>
      )}

      {/* Business unit schema drop */}
      {isBusinessUnit && tenantSchema && !keepsSharedSchema && (
        <label className="flex items-center gap-3 rounded-md border border-warning-border bg-warning-subtle p-3 text-sm text-warning-subtle-foreground aria-disabled:opacity-60" aria-disabled={dropBlocked}>
          <Checkbox
            checked={dropSchema && !dropBlocked}
            disabled={dropBlocked}
            onChange={(e) => setDropSchema(e.target.checked)}
          />
          <span>
            Also <strong>DROP SCHEMA &quot;{tenantSchema}&quot; CASCADE</strong> (wipes the
            entire tenant database for this business unit)
          </span>
        </label>
      )}

      {/* Orphan schema drop */}
      {orphanSchemas && orphanSchemas.length > 0 && (
        <div className="space-y-2">
          <label className="flex items-start gap-3 rounded-md border border-warning-border bg-warning-subtle p-3 text-sm text-warning-subtle-foreground aria-disabled:opacity-60" aria-disabled={dropBlocked}>
            <Checkbox
              checked={dropSchema && !dropBlocked}
              disabled={dropBlocked}
              onChange={(e) => setDropSchema(e.target.checked)}
            />
            <span>
              Also <strong>DROP {orphanSchemas.length} tenant schema(s) CASCADE</strong>:{" "}
              <code className="rounded bg-black/10 px-1 font-mono text-xs">
                {orphanSchemas.join(", ")}
              </code>{" "}
              (wipes each tenant database)
            </span>
          </label>
          <p className="text-xs text-foreground-subtle">
            The confirmation phrase below stays DELETE.
          </p>
        </div>
      )}

      {isBusinessUnit && tenantSchema && !keepsSharedSchema && (
        <p className="text-xs text-foreground-subtle">
          If you check the schema-drop box, the required phrase becomes the schema name.
        </p>
      )}

      <SealConfirm
        requiredPhrase={requiredPhrase}
        onStamp={submit}
        disabled={radius.truncated}
        pending={running}
        label="Confirm and permanently delete"
      />

      <OperationProgress state={state} rolledBackOnError />
        </div>
      </div>
    </div>
  );
}
