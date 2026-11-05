"use client";
import { useEffect, useState } from "react";
import { readBatchSelection } from "@/lib/batch-selection";
import { previewBatchDelete, type BatchDeletePreview } from "@/server/batch-delete";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Alert } from "@/components/ui/alert";

type State =
  | { phase: "loading" }
  | { phase: "missing" }
  | { phase: "error"; message: string }
  | { phase: "ready"; pks: Record<string, unknown>[]; preview: BatchDeletePreview };

export function BatchDeleteLoader({ schema, table }: { schema: string; table: string }) {
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    const pks = readBatchSelection(schema, table);
    const next: Promise<State> = pks
      ? previewBatchDelete(schema, table, pks).then((preview) => ({ phase: "ready", pks, preview }))
      : Promise.resolve({ phase: "missing" });
    next.then(
      (s) => { if (!cancelled) setState(s); },
      (err: unknown) => {
        if (!cancelled) setState({ phase: "error", message: err instanceof Error ? err.message : String(err) });
      },
    );
    return () => { cancelled = true; };
  }, [schema, table]);

  if (state.phase === "loading") {
    return <p className="text-sm text-foreground-muted">Computing blast radius…</p>;
  }
  if (state.phase === "missing") {
    return (
      <Alert variant="warning" title="No selection to delete.">
        <p>The selected rows were not found in this tab. Go back to the table and select them again.</p>
      </Alert>
    );
  }
  if (state.phase === "error") {
    return <Alert variant="danger" title="Could not compute the blast radius.">{state.message}</Alert>;
  }

  const { pks, preview } = state;
  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold tracking-tight">
        Delete {pks.length} selected row(s) from <span className="font-mono">{schema}.{table}</span>
      </h1>
      {preview.orphanWarning && (
        <Alert variant="warning" title="Tenant schemas will be left orphaned.">
          <p>
            This cascade deletes <strong>business-unit registry rows</strong>, but their tenant Postgres
            schemas are not linked by a foreign key and will <strong>not</strong> be dropped. They will be
            left orphaned. To drop a tenant schema, delete that business unit individually from the
            registry.
          </p>
        </Alert>
      )}
      <ConfirmDelete schema={schema} table={table} pkJson={JSON.stringify(pks)} radius={preview.radius}
        isBusinessUnit={false} tenantSchema={null}
        requiredPhrase={preview.requiredPhrase} />
    </div>
  );
}
