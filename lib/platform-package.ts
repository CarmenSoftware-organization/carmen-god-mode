import * as path from "node:path";
import * as fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { env } from "@/lib/env";

const execFileP = promisify(execFile);

export const DEFAULT_REL = "../carmen-turborepo-backend/packages/prisma-shared-schema-platform";

export function packageDir(): string {
  return env().platformPackageDir ?? path.resolve(process.cwd(), DEFAULT_REL);
}

export async function assertPackageDir(): Promise<void> {
  const dir = packageDir();
  try {
    await fs.access(path.join(dir, "package.json"));
  } catch {
    throw new Error(`Platform package not found at ${dir} (set BACKSTAGE_PACKAGE_DIR)`);
  }
}

export function withSchemaParam(url: string, schema: string): string {
  const u = new URL(url);
  u.searchParams.set("schema", schema);
  return u.toString();
}

export function buildSubprocessEnv(schema: string): NodeJS.ProcessEnv {
  const e = env();
  return {
    ...process.env,
    SYSTEM_DATABASE_URL: withSchemaParam(e.systemDatabaseUrl, schema),
    SYSTEM_DIRECT_URL: withSchemaParam(e.systemDirectUrl, schema),
    SYSTEM_SCHEMA_NAME: schema,
  };
}

export function targetDbInfo(schema?: string): { host: string; database: string; schema: string; masked: string } {
  const u = new URL(env().systemDatabaseUrl);
  const host = u.port ? `${u.hostname}:${u.port}` : u.hostname;
  const database = decodeURIComponent(u.pathname.replace(/^\//, ""));
  const masked = `${u.protocol}//${u.username}@${host}/${database}`;
  return { host, database, schema: schema ?? env().systemSchemaName, masked };
}

export async function assertPsql(): Promise<void> {
  try {
    await execFileP("psql", ["--version"]);
  } catch {
    throw new Error("psql not found on PATH (required for tenant-view migrations)");
  }
}

export async function listTenantFiles(): Promise<string[]> {
  const dir = path.join(packageDir(), "migrations", "tenant");
  try {
    const all = await fs.readdir(dir);
    return all.filter((f) => f.endsWith(".up.sql")).sort();
  } catch {
    return [];
  }
}

export async function readPackageScripts(): Promise<Record<string, string> | null> {
  try {
    const raw = await fs.readFile(path.join(packageDir(), "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { scripts?: Record<string, string> };
    return parsed.scripts ?? null;
  } catch {
    return null;
  }
}
