import { z } from "zod";

const schema = z.object({
  SYSTEM_DATABASE_URL: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  SYSTEM_SCHEMA_NAME: z.string().min(1).default("CARMEN_SYSTEM"),
  GOD_MODE_PASSWORD: z.string().min(1),
  GOD_MODE_USER_ID: z.string().uuid().optional(),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be >= 32 chars"),
  CASCADE_MAX_ROWS: z.coerce.number().int().positive().default(5000),
  CASCADE_MAX_DEPTH: z.coerce.number().int().positive().default(20),
  BACKEND_API_BASE_URL: z.string().url().optional(),
  BACKEND_API_APP_ID: z.string().min(1).default("42ab2083-5dbd-47fc-bb32-3de97dc0cd89"),
  BACKEND_API_INSECURE_TLS: z.string().optional(),
  SYSTEM_DIRECT_URL: z.string().min(1).optional(),
  BACKSTAGE_PACKAGE_DIR: z.string().min(1).optional(),
  ALLOW_DANGER_OPS: z.string().optional(),
});

export type Env = {
  systemDatabaseUrl: string;
  databaseUrl: string;
  systemSchemaName: string;
  godModePassword: string;
  godModeUserId?: string;
  sessionSecret: string;
  cascadeMaxRows: number;
  cascadeMaxDepth: number;
  backendApiBaseUrl?: string;
  backendApiAppId: string;
  backendApiInsecureTls: boolean;
  gatewayEnabled: boolean;
  systemDirectUrl: string;
  platformPackageDir?: string;
  allowDangerOps: boolean;
};

export function loadEnv(raw: Record<string, string | undefined>): Env {
  const p = schema.parse(raw);
  return {
    systemDatabaseUrl: p.SYSTEM_DATABASE_URL,
    databaseUrl: p.DATABASE_URL,
    systemSchemaName: p.SYSTEM_SCHEMA_NAME,
    godModePassword: p.GOD_MODE_PASSWORD,
    godModeUserId: p.GOD_MODE_USER_ID,
    sessionSecret: p.SESSION_SECRET,
    cascadeMaxRows: p.CASCADE_MAX_ROWS,
    cascadeMaxDepth: p.CASCADE_MAX_DEPTH,
    backendApiBaseUrl: p.BACKEND_API_BASE_URL,
    backendApiAppId: p.BACKEND_API_APP_ID,
    backendApiInsecureTls: p.BACKEND_API_INSECURE_TLS === "true",
    gatewayEnabled: !!p.BACKEND_API_BASE_URL,
    systemDirectUrl: p.SYSTEM_DIRECT_URL ?? p.SYSTEM_DATABASE_URL,
    platformPackageDir: p.BACKSTAGE_PACKAGE_DIR,
    allowDangerOps: p.ALLOW_DANGER_OPS === "true",
  };
}

let cached: Env | null = null;
export function env(): Env {
  if (!cached) cached = loadEnv(process.env);
  return cached;
}
