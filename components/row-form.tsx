import type { ColumnInfo } from "@/lib/introspect";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function RowForm({
  columns,
  initial,
  action,
  submitLabel,
}: {
  columns: ColumnInfo[];
  initial?: Record<string, unknown>;
  action: (fd: FormData) => void;
  submitLabel: string;
}) {
  return (
    <form action={action} className="max-w-xl space-y-4">
      {columns.map((c) => {
        const v = initial?.[c.name];
        const text =
          v === null || v === undefined
            ? ""
            : typeof v === "object"
              ? JSON.stringify(v, null, 2)
              : String(v);
        const isJson = c.udtName === "json" || c.udtName === "jsonb";

        return (
          <div key={c.name} className="space-y-1.5">
            <label htmlFor={`f_${c.name}`} className="block text-sm font-medium">
              <span className="font-mono text-xs text-foreground-muted">{c.name}</span>{" "}
              {c.isNullable ? (
                <span className="text-xs text-foreground-subtle">nullable</span>
              ) : (
                <span className="text-xs text-danger-subtle-foreground">required</span>
              )}
            </label>

            {isJson ? (
              <Textarea
                id={`f_${c.name}`}
                name={`f_${c.name}`}
                defaultValue={text}
                rows={4}
                className="font-mono text-xs"
              />
            ) : (
              <Input
                id={`f_${c.name}`}
                name={`f_${c.name}`}
                defaultValue={text}
              />
            )}

            {/* Helper: data type hint */}
            <span className="block text-xs text-foreground-subtle">{c.dataType}</span>

            {/* Nullable toggle */}
            {c.isNullable && (
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-foreground-muted">
                <input
                  type="checkbox"
                  name={`null_${c.name}`}
                  defaultChecked={v === null}
                  className="rounded border-border-strong"
                />
                Set NULL
              </label>
            )}
          </div>
        );
      })}

      <Button type="submit" variant="primary">
        {submitLabel}
      </Button>
    </form>
  );
}
