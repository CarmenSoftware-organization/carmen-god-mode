import { env } from "@/lib/env";
import { LoginTabs } from "@/app/login/login-tabs";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm overflow-hidden rounded-md border border-border bg-surface shadow-sm">
        <div className="border-b border-border" aria-hidden="true" />
        <div className="space-y-6 p-6">
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-medium tracking-tight text-foreground">
                CARMEN
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-danger-subtle-foreground">God Mode</span>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Restricted console</p>
              <p className="text-sm text-foreground-muted">
                Sign in to operate on live inventory data. Every write is permanent.
              </p>
            </div>
          </div>
          <LoginTabs gatewayEnabled={env().gatewayEnabled} />
        </div>
      </div>
    </main>
  );
}
