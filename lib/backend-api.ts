import { z } from "zod";
import { env } from "@/lib/env";

const TIMEOUT_MS = 10_000;

export type GatewayReason = "invalid_credentials" | "not_super_admin" | "gateway_unavailable";
export type SuperAdminResult = { ok: true; actor: string } | { ok: false; reason: GatewayReason };

class GatewayError extends Error {
  constructor(public reason: GatewayReason) {
    super(reason);
  }
}

const loginSchema = z.object({ access_token: z.string().min(1) }).passthrough();
const permissionSchema = z.object({ is_super_admin: z.boolean().optional() }).passthrough();

async function readJson(res: Response, reason: GatewayReason): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw new GatewayError(reason);
  }
}

function unwrap(body: unknown): unknown {
  if (body && typeof body === "object" && "data" in body) {
    const inner = (body as { data: unknown }).data;
    if (inner && typeof inner === "object") return inner;
  }
  return body;
}

async function insecureDispatcher(): Promise<unknown | undefined> {
  if (!env().backendApiInsecureTls) return undefined;
  const { Agent } = await import("undici");
  return new Agent({ connect: { rejectUnauthorized: false } });
}

type FetchInit = RequestInit & { dispatcher?: unknown };

async function apiFetch(path: string, init: FetchInit): Promise<Response> {
  const base = env().backendApiBaseUrl;
  if (!base) throw new GatewayError("gateway_unavailable");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const dispatcher = await insecureDispatcher();
    return await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
        "x-app-id": env().backendApiAppId,
      },
      ...(dispatcher ? { dispatcher } : {}),
    });
  } finally {
    clearTimeout(timer);
  }
}

async function gatewayLogin(username: string, password: string): Promise<string> {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new GatewayError("invalid_credentials");
  const parsed = loginSchema.safeParse(unwrap(await readJson(res, "invalid_credentials")));
  if (!parsed.success) throw new GatewayError("invalid_credentials");
  return parsed.data.access_token;
}

async function fetchBackstagePermission(token: string): Promise<boolean> {
  const res = await apiFetch("/api/user/permission/backstage", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new GatewayError("not_super_admin");
  const parsed = permissionSchema.safeParse(unwrap(await readJson(res, "not_super_admin")));
  if (!parsed.success) throw new GatewayError("not_super_admin");
  return parsed.data.is_super_admin === true;
}

export async function verifySuperAdmin(username: string, password: string): Promise<SuperAdminResult> {
  try {
    const token = await gatewayLogin(username, password);
    const isSuperAdmin = await fetchBackstagePermission(token);
    return isSuperAdmin ? { ok: true, actor: username } : { ok: false, reason: "not_super_admin" };
  } catch (e) {
    if (e instanceof GatewayError) return { ok: false, reason: e.reason };
    return { ok: false, reason: "gateway_unavailable" };
  }
}
