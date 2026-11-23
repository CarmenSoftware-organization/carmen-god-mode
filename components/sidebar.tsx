"use client";
import { useState } from "react";
import Link from "next/link";
import {
  PanelLeftClose,
  PanelLeft,
  LogOut,
  Menu,
  X,
  Database,
  Boxes,
  ScrollText,
  GitBranch,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/server/auth";
import { NavLink } from "@/components/nav-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/cn";

export type NavItem = { href: string; label: string; icon: LucideIcon };

// The nav lives here (a client module) so the lucide icon components are never
// passed as props across the Server→Client boundary — a Server Component that
// hands an icon component to this client Sidebar trips React's "only plain
// objects can be passed to Client Components" serialization error.
const NAV: NavItem[] = [
  { href: "/schemas", label: "Schemas", icon: Database },
  { href: "/clusters", label: "Clusters", icon: Boxes },
  { href: "/audit", label: "Audit", icon: ScrollText },
  { href: "/platform-migrations", label: "Migrations", icon: GitBranch },
];

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href="/schemas" className="flex items-center gap-2 px-3 py-4" aria-label="Carmen God Mode — home">
      <span className="text-lg font-bold tracking-tight text-foreground">CARMEN</span>
      {!collapsed && (
        <span className="rounded bg-danger px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-danger-foreground">
          God Mode
        </span>
      )}
    </Link>
  );
}

function Rail({ items, collapsed }: { items: NavItem[]; collapsed: boolean }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2" aria-label="Primary">
      {items.map((it) => (
        <NavLink key={it.href} href={it.href} label={it.label} icon={it.icon} collapsed={collapsed} />
      ))}
    </nav>
  );
}

function Footer({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1 border-t border-border p-2", collapsed && "items-center")}>
      <ThemeToggle showLabel={!collapsed} />
      <form action={logout}>
        <button
          type="submit"
          aria-label={collapsed ? "Log out" : undefined}
          className={cn(
            "inline-flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-hover hover:text-foreground",
            collapsed && "justify-center px-2",
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed && <span>Log out</span>}
        </button>
      </form>
    </div>
  );
}

export function Sidebar({ items = NAV }: { items?: NavItem[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop rail */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex",
          "transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <Brand collapsed={collapsed} />
        <Rail items={items} collapsed={collapsed} />
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="mx-2 mb-1 inline-flex items-center justify-center rounded-md p-2 text-foreground-subtle transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
        <Footer collapsed={collapsed} />
      </aside>

      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        className="fixed left-3 top-3 z-40 inline-flex items-center justify-center rounded-md border border-border bg-surface p-2 text-foreground md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <div className="flex items-center justify-between">
              <Brand collapsed={false} />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="mr-2 rounded-md p-2 text-foreground-subtle hover:bg-surface-hover hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div onClick={() => setMobileOpen(false)}>
              <Rail items={items} collapsed={false} />
            </div>
            <Footer collapsed={false} />
          </div>
        </div>
      )}
    </>
  );
}
