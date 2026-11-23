import { forwardRef } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/**
 * Accessible checkbox. Native input drives state/a11y; a styled box renders the
 * check glyph. Keyboard-operable, visible focus ring.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, checked, ...props },
  ref,
) {
  return (
    <span className="relative inline-flex h-4 w-4 shrink-0 align-middle">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        className={cn(
          "peer absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none opacity-0",
          className,
        )}
        {...props}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none flex h-4 w-4 items-center justify-center rounded border border-border-strong bg-surface",
          "peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-foreground",
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
          "peer-disabled:opacity-50",
          // The tick is a descendant, not a sibling, of the peer input, so it is
          // revealed through this span. Unchecked boxes must look empty.
          "peer-checked:[&_svg]:opacity-100",
        )}
      >
        <Check className="h-3 w-3 font-bold opacity-0 transition-opacity" />
      </span>
    </span>
  );
});
