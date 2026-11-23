"use client";
import { useMemo, useState } from "react";
import { TriangleAlert, CircleX } from "lucide-react";
import { useOperationStream } from "@/components/use-operation-stream";
import { OperationProgress } from "@/components/operation-progress";
import { OperationLog } from "@/components/operation-log";
import { canRun, validateSchemaName, type CatalogOp, type OpGroup, type ScriptInfo } from "@/lib/platform-migrations";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";

export type TargetDb = { masked: string; database: string; schema: string };

const GROUPS: { key: OpGroup; title: string }[] = [
  { key: "prisma", title: "Prisma schema migrations" },
  { key: "tenant", title: "Tenant view migrations (all active BU schemas)" },
  { key: "seed", title: "Seed scripts" },
  { key: "check", title: "Drift checks (read-only)" },
  { key: "danger", title: "Danger zone: destructive resets" },
];

export function PlatformMigrations({
  target,
  catalog,
  buCodes,
  tenantFiles,
  schemas,
  defaultSchema,
  scriptInfo = {},
}: {
  target: TargetDb;
  catalog: CatalogOp[];
  buCodes: string[];
  tenantFiles: string[];
  schemas: string[];
  defaultSchema: string;
  scriptInfo?: Record<string, ScriptInfo>;
}) {
  const { state, start } = useOperationStream();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [schema, setSchema] = useState(defaultSchema);
  const [bu, setBu] = useState("");
  const [only, setOnly] = useState("");
  const [confirm, setConfirm] = useState("");
  const [destroyChecked, setDestroyChecked] = useState(false);
  const [createChecked, setCreateChecked] = useState(false);

  const op = useMemo(
    () => catalog.find((o) => o.id === selectedId) ?? null,
    [catalog, selectedId],
  );
  const schemaStatus = validateSchemaName(schema, schemas);
  const isNewSchema = schemaStatus === "new";
  const running = state.phase === "running";
  const enabled =
    !!op &&
    !running &&
    canRun(op, {
      confirm,
      schema,
      knownSchemas: schemas,
      destroyChecked,
      createChecked,
    });

  const run = () => {
    if (!op) return;
    start("/api/ops/platform-migrate", {
      opId: op.id,
      schema,
      bu: op.acceptsBu && bu ? bu : undefined,
      only: op.acceptsOnly && only ? only : undefined,
      confirm,
      confirmDestroy: op.destructive ? destroyChecked : undefined,
      confirmCreateSchema: isNewSchema ? createChecked : undefined,
    });
  };

  const select = (id: string) => {
    setSelectedId(id);
    setBu("");
    setOnly("");
    setConfirm("");
    setDestroyChecked(false);
    setCreateChecked(false);
  };

  const writeOp = !!op && op.writes && !op.readonly;

  return (
    <div className="space-y-4">
      {/* Target info */}
      <div className="flex items-center gap-2 rounded-md border border-warning-border bg-warning-subtle px-3 py-2 text-sm text-warning-subtle-foreground">
        <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Target:{" "}
          <code className="font-mono">{target.masked}</code>{" "}
          <span className="text-foreground-subtle">
            (schema{" "}
            <code className="font-mono">{schema || "\u2014"}</code>
            {isNewSchema && (
              <span className="font-semibold">, NEW</span>
            )}
            {")"}
          </span>
        </span>
      </div>

      {/* Schema input */}
      <label className="block text-sm font-medium">
        Target schema
        <Input
          list="schemas"
          aria-label="schema"
          className="mt-1 ml-0 max-w-xs"
          value={schema}
          placeholder="e.g. CARMEN_SYSTEM"
          onChange={(e) => {
            setSchema(e.target.value);
            setCreateChecked(false);
          }}
        />
        <datalist id="schemas">
          {schemas.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        {schemaStatus === "invalid" && schema.length > 0 && (
          <p className="mt-1 text-xs font-medium text-danger-subtle-foreground">
            Invalid schema name
          </p>
        )}
      </label>

      {/* Operation groups */}
      {GROUPS.map((g) => {
        const ops = catalog.filter((o) => o.group === g.key);
        if (!ops.length) return null;
        const danger = g.key === "danger";
        return (
          <fieldset
            key={g.key}
            className={cn(
              "rounded-lg border p-3",
              danger
                ? "border-danger-border bg-danger-subtle"
                : "border-border bg-surface",
            )}
          >
            <legend
              className={cn(
                "px-2 text-sm font-semibold",
                danger ? "text-danger-subtle-foreground" : "text-foreground",
              )}
            >
              {g.title}
            </legend>
            <div className="space-y-1.5">
              {ops.map((o) => {
                const info = scriptInfo[o.id];
                return (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-start gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="op"
                      checked={selectedId === o.id}
                      onChange={() => select(o.id)}
                      className="mt-0.5 accent-accent"
                    />
                    <span className="flex flex-col">
                      <span className="flex items-center gap-1.5">
                        {o.label}
                        {info?.missing && (
                          <span className="inline-flex items-center gap-1 rounded border border-warning-border bg-warning-subtle px-1.5 py-0.5 text-xs font-medium text-warning-subtle-foreground">
                            <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                            not in package
                          </span>
                        )}
                      </span>
                      {info && (
                        <span className="font-mono text-xs text-foreground-subtle">
                          {info.file ? `${info.script} · ${info.file}` : info.script}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {/* Business unit select */}
      {op?.acceptsBu && (
        <label className="block text-sm font-medium">
          Business unit (optional)
          <select
            className="mt-1 max-w-xs rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
            value={bu}
            onChange={(e) => setBu(e.target.value)}
          >
            <option value="">all active</option>
            {buCodes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* File prefix filter */}
      {op?.acceptsOnly && (
        <label className="block text-sm font-medium">
          Only file prefix (optional)
          <Input
            list="tenant-files"
            className="mt-1 max-w-xs"
            value={only}
            onChange={(e) => setOnly(e.target.value)}
            placeholder="e.g. 001_v_operational"
          />
          <datalist id="tenant-files">
            {tenantFiles.map((f) => (
              <option key={f} value={f.replace(/\.up\.sql$/, "")} />
            ))}
          </datalist>
        </label>
      )}

      {/* Confirm phrase */}
      {writeOp && (
        <label className="block text-sm font-medium">
          Type the schema name{" "}
          <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">
            {schema}
          </code>{" "}
          to confirm
          <Input
            aria-label="confirm"
            className="mt-1 max-w-xs"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
      )}

      {/* New schema checkbox */}
      {writeOp && isNewSchema && (
        <label className="flex items-center gap-3 rounded-md border border-warning-border bg-warning-subtle p-3 text-sm text-warning-subtle-foreground">
          <Checkbox
            checked={createChecked}
            onChange={(e) => setCreateChecked(e.target.checked)}
          />
          <span>
            Create new schema{" "}
            <code className="font-mono">{schema}</code>
          </span>
        </label>
      )}

      {/* Destructive confirmation */}
      {op?.destructive && (
        <label className="flex items-center gap-3 rounded-md border border-danger-border bg-danger-subtle p-3 text-sm text-danger-subtle-foreground">
          <Checkbox
            checked={destroyChecked}
            onChange={(e) => setDestroyChecked(e.target.checked)}
          />
          <span>
            <CircleX className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
            I understand this destroys data
          </span>
        </label>
      )}

      {/* Run button */}
      <Button
        onClick={run}
        disabled={!enabled}
        pending={running}
        variant={op?.destructive ? "danger" : "primary"}
      >
        {running ? "Running..." : "Run"}
      </Button>

      <OperationProgress state={state} />
      <OperationLog state={state} />
    </div>
  );
}
