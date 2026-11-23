"use client";
import { useActionState, useState } from "react";
import { ArrowRight } from "lucide-react";
import { login, gatewayLogin } from "@/server/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Tab = "gateway" | "secret";

export function LoginTabs({ gatewayEnabled }: { gatewayEnabled: boolean }) {
  const [tab, setTab] = useState<Tab>(gatewayEnabled ? "gateway" : "secret");
  const [gwState, gwAction, gwPending] = useActionState(gatewayLogin, {});
  const [secState, secAction, secPending] = useActionState(login, {});

  return (
    <div className="space-y-4">
      {gatewayEnabled && (
        <div role="tablist" className="flex items-center gap-1 border-b border-border">
          {(["gateway", "secret"] as const).map((t) => {
            const active = tab === t;
            const label = t === "gateway" ? "Gateway login" : "Shared secret";
            return (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setTab(t)}
                className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "text-foreground"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                {label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {gatewayEnabled && tab === "gateway" && (
        <form action={gwAction} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="username" className="block text-sm font-medium">
              Email or username
            </label>
            <Input id="username" name="username" placeholder="you@example.com" required />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <Input id="password" name="password" type="password" required />
          </div>
          {gwState.error && (
            <p role="alert" className="text-sm font-medium text-danger-subtle-foreground">
              {gwState.error}
            </p>
          )}
          <Button type="submit" disabled={gwPending} pending={gwPending} className="w-full">
            {gwPending ? "Signing in..." : "Enter"}
            {!gwPending && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </form>
      )}

      {tab === "secret" && (
        <form action={secAction} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="actor" className="block text-sm font-medium">
              Your name (for audit)
            </label>
            <Input id="actor" name="actor" placeholder="Jane Operator" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="secret" className="block text-sm font-medium">
              Shared secret
            </label>
            <Input id="secret" name="secret" type="password" required />
          </div>
          {secState.error && (
            <p role="alert" className="text-sm font-medium text-danger-subtle-foreground">
              {secState.error}
            </p>
          )}
          <Button type="submit" disabled={secPending} pending={secPending} className="w-full">
            {secPending ? "Entering..." : "Enter"}
            {!secPending && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </form>
      )}
    </div>
  );
}
