"use client";
import { useOperationStream } from "@/components/use-operation-stream";
import { OperationProgress } from "@/components/operation-progress";
import { Alert } from "@/components/ui/alert";
import { SealConfirm } from "@/components/seal-confirm";

/**
 * Confirm ceremony for dropping a whole schema: type the exact schema name to
 * arm, then press-and-hold to fire `DROP SCHEMA … CASCADE`. Streams progress.
 */
export function DropSchemaConfirm({ schema }: { schema: string }) {
  const { state, start } = useOperationStream();
  const running = state.phase === "running";

  function submit() {
    start("/api/ops/drop-schema", { schema, confirm: schema });
  }

  return (
    <div className="max-w-2xl">
      <div className="overflow-hidden rounded-md border border-danger-border bg-surface">
        <div className="flex items-center gap-2 border-b border-border bg-danger-subtle px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-danger-subtle-foreground">Armed</span>
          <span aria-hidden="true" className="text-danger-border">/</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-danger-subtle-foreground">
            Irreversible
          </span>
        </div>

        <div className="space-y-4 p-4">
          <Alert
            variant="danger"
            title={`DROP SCHEMA "${schema}" CASCADE — permanently wipes every table, row, and object in this schema.`}
          >
            <p>
              This runs on a live database and cannot be undone. The entire schema and all its
              data are destroyed.
            </p>
          </Alert>

          <SealConfirm
            requiredPhrase={schema}
            onStamp={submit}
            pending={running}
            label={`Confirm and permanently drop ${schema}`}
          />

          <OperationProgress state={state} rolledBackOnError />
        </div>
      </div>
    </div>
  );
}
