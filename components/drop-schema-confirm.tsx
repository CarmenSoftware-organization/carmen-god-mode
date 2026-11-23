"use client";
import Link from "next/link";
import type { SchemaFootprint } from "@/lib/introspect";
import { useOperationStream } from "@/components/use-operation-stream";
import { OperationProgress } from "@/components/operation-progress";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SealConfirm } from "@/components/seal-confirm";

function describe(f: SchemaFootprint): string {
  if (f.tables === 0) return "no tables";
  return `${f.tables} table(s), about ${f.estimatedRows.toLocaleString()} row(s), ${f.size}`;
}

/**
 * Confirm ceremony for dropping a whole schema: show what it holds, then type
 * the exact schema name to arm and press-and-hold to fire
 * `DROP SCHEMA … CASCADE`. Streams progress.
 */
export function DropSchemaConfirm({
  schema,
  footprint,
  lookAlikes = [],
}: {
  schema: string;
  /** Catalog footprint of the schema; null when it couldn't be read. */
  footprint: SchemaFootprint | null;
  /** Other schemas whose names differ only by case or separators. */
  lookAlikes?: { name: string; footprint: SchemaFootprint | null }[];
}) {
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
            title={`Permanently wipes schema "${schema}" and everything in it.`}
          >
            <p>Runs DROP SCHEMA … CASCADE on a live database. It cannot be undone.</p>
          </Alert>

          {/* What is inside, so the operator isn't dropping blind. */}
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">What this removes</p>
            {footprint ? (
              <ul className="grid grid-cols-[max-content_1fr] gap-x-2 gap-y-1 text-sm">
                <li className="contents">
                  <span className="text-right font-semibold tabular-nums">{footprint.tables}</span>
                  <span className="text-foreground-muted">table(s)</span>
                </li>
                <li className="contents">
                  <span className="text-right font-semibold tabular-nums">≈{footprint.estimatedRows.toLocaleString()}</span>
                  <span className="text-foreground-muted">row(s), planner estimate</span>
                </li>
                <li className="contents">
                  <span className="text-right font-semibold tabular-nums">{footprint.size}</span>
                  <span className="text-foreground-muted">on disk, including indexes</span>
                </li>
              </ul>
            ) : (
              <p className="text-sm text-foreground-muted">The schema&apos;s contents could not be read.</p>
            )}
          </div>

          {lookAlikes.length > 0 && (
            <Alert variant="warning" title="Similar schema names exist: check this is the one you mean">
              <ul className="mt-1 space-y-0.5">
                <li>
                  <code className="font-mono text-xs font-semibold">{schema}</code> (this one):{" "}
                  {footprint ? describe(footprint) : "contents unknown"}
                </li>
                {lookAlikes.map((l) => (
                  <li key={l.name}>
                    <code className="font-mono text-xs">{l.name}</code>:{" "}
                    {l.footprint ? describe(l.footprint) : "contents unknown"}
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          <SealConfirm
            requiredPhrase={schema}
            onStamp={submit}
            pending={running}
            label={`Confirm and permanently drop ${schema}`}
          />

          {!running && state.phase !== "done" && (
            <Link href="/schemas" className="block">
              <Button variant="outline" className="w-full">Cancel, keep everything</Button>
            </Link>
          )}

          <OperationProgress state={state} rolledBackOnError />
        </div>
      </div>
    </div>
  );
}
