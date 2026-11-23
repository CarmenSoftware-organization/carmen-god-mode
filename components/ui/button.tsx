import { forwardRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Shared button primitive. Token-driven, dual-mode, one radius scale (rounded-md),
 * one height scale. Use `asChild`-free variant pattern: pass `as={Link}` etc. via a
 * wrapping <Link> if navigation is needed, or use <Button asChild>.
 */
const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50";

const variants = {
  // Default: solid foreground (accent)
  primary:
    "bg-accent text-accent-foreground hover:bg-accent-hover shadow-sm",
  // Destructive: red
  danger: "bg-danger text-danger-foreground hover:bg-danger-hover shadow-sm",
  // Outlined / secondary
  outline:
    "border border-border bg-surface text-foreground hover:bg-surface-hover",
  // Ghost (text-only, hover fill)
  ghost: "text-foreground-muted hover:bg-surface-hover hover:text-foreground",
  // Subtle danger (text red). Uses the AA-tuned danger text tone: plain --danger
  // is only ~3.8:1 as small text on a light surface.
  "danger-ghost":
    "text-danger-subtle-foreground hover:bg-danger-subtle hover:text-danger-subtle-foreground",
  // Warning (amber, for soft-delete)
  warning:
    "bg-warning text-warning-foreground hover:bg-warning/90 shadow-sm",
  // Success (green, for restore)
  success:
    "bg-success text-accent-foreground hover:bg-success-hover shadow-sm",
} as const;

const sizes = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4",
  lg: "h-10 px-5 text-sm",
  icon: "h-9 w-9",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", pending, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
});
