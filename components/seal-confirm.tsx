"use client";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

/**
 * A two-step irreversible-action confirm ceremony that replaces a plain
 * destructive submit button. Step one: type the exact confirm phrase to arm
 * the control. Step two: press-and-hold the control (~holdMs) to confirm,
 * which fires `onStamp`. Releasing early cancels. Keyboard: focus + hold
 * Space/Enter. Meaning-by-fill + a real hold make the friction proportional
 * to consequence.
 */
export function SealConfirm({
  requiredPhrase,
  onStamp,
  disabled = false,
  pending = false,
  holdMs = 700,
  label = "Confirm & execute",
}: {
  requiredPhrase: string;
  onStamp: () => void;
  disabled?: boolean;
  pending?: boolean;
  holdMs?: number;
  label?: string;
}) {
  const [confirm, setConfirm] = useState("");
  const [holding, setHolding] = useState(false);
  const [sealed, setSealed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const armed = confirm === requiredPhrase;
  const canSeal = armed && !disabled && !pending && !sealed;

  function begin() {
    if (!canSeal || holding || timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      setSealed(true);
      onStamp();
    }, holdMs);
  }
  function cancel() {
    setHolding(false);
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // If the parent blocks the action mid-hold (e.g. blast radius truncates),
  // abandon any pending stamp so the external block can't be outrun. Clearing
  // the timer here is a ref/external cleanup (no setState); the hold's visual
  // state is derived from the block below, so the fill snaps back too.
  useEffect(() => {
    if ((disabled || pending) && timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, [disabled, pending]);

  // A hold only counts while the action isn't externally blocked; deriving
  // this (instead of resetting state in the effect) resets the fill on block
  // without a cascading-render setState-in-effect.
  const showHold = holding && !disabled && !pending;

  const face = sealed
    ? "Confirmed"
    : pending
      ? "Confirming…"
      : armed
        ? "Press & hold to confirm"
        : "Type the phrase to arm";

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="seal-confirm-input" className="block text-sm font-medium">
          Type{" "}
          <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">
            {requiredPhrase}
          </code>{" "}
          to arm:
        </label>
        <Input
          id="seal-confirm-input"
          name="confirm"
          autoComplete="off"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      <button
        type="button"
        aria-label={label}
        aria-disabled={!canSeal}
        aria-busy={pending || showHold || undefined}
        data-armed={armed}
        data-holding={showHold}
        data-sealed={sealed}
        onMouseDown={begin}
        onMouseUp={cancel}
        onMouseLeave={cancel}
        onTouchStart={begin}
        onTouchEnd={cancel}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            begin();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") cancel();
        }}
        className={cn(
          "relative flex h-11 w-full select-none items-center justify-center overflow-hidden rounded-md border transition-colors",
          canSeal ? "border-seal" : "cursor-not-allowed border-border",
        )}
      >
        {/* Ink fill grows left→right over holdMs while holding, then stays. */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 origin-left bg-seal",
            showHold || sealed ? "scale-x-100" : "scale-x-0",
          )}
          style={{
            transition: showHold
              ? `transform ${holdMs}ms linear`
              : "transform 140ms ease-out",
          }}
        />
        <span
          className={cn(
            "relative text-sm font-medium uppercase tracking-[0.12em]",
            showHold || sealed
              ? "text-danger-foreground"
              : canSeal
                ? "text-danger-subtle-foreground"
                : "text-foreground-subtle",
          )}
        >
          {face}
        </span>
      </button>
    </div>
  );
}
