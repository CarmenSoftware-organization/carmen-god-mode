"use client";
import type { OperationState } from "@/lib/operation-stream";

export function OperationProgress({
  state,
  rolledBackOnError,
}: {
  state: OperationState;
  rolledBackOnError?: boolean;
}) {
  if (state.phase === "idle") return null;

  const determinate = state.total != null && state.total > 0;
  const pct = determinate
    ? Math.min(100, Math.round((state.done / state.total!) * 100))
    : null;

  return (
    <div className="space-y-1.5" role="status" aria-live="polite">
      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-border">
        {state.phase === "done" ? (
          <div className="h-full rounded-full bg-success transition-all" style={{ width: "100%" }} />
        ) : state.phase === "error" ? (
          <div className="h-full rounded-full bg-danger transition-all" style={{ width: "100%" }} />
        ) : determinate ? (
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-accent/60" />
        )}
      </div>

      {/* Status text */}
      {state.phase === "running" && (
        <p className="text-xs text-foreground-muted">
          {pct != null ? `${pct}% \u00B7 ` : ""}
          {state.label}
        </p>
      )}
      {state.phase === "done" && (
        <p className="text-xs font-medium text-success-subtle-foreground">
          {state.summary}
        </p>
      )}
      {state.phase === "error" && (
        <div className="text-xs text-danger-subtle-foreground">
          <p>{state.error}</p>
          {rolledBackOnError && (
            <p className="mt-0.5 text-danger-subtle-foreground">
              No changes were applied. The operation was rolled back.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
