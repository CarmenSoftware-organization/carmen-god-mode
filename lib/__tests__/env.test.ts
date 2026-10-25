import { expect, test } from "vitest";
import { loadEnv } from "@/lib/env";

const base = {
  SYSTEM_DATABASE_URL: "postgresql://u:p@h:6432/postgres",
  DATABASE_URL: "postgresql://u:p@h:6432/postgres",
  GOD_MODE_PASSWORD: "secret",
  SESSION_SECRET: "x".repeat(32),
};

test("parses with defaults", () => {
  const env = loadEnv(base);
  expect(env.systemSchemaName).toBe("CARMEN_SYSTEM");
  expect(env.cascadeMaxRows).toBe(5000);
  expect(env.cascadeMaxDepth).toBe(20);
});

test("throws when a required var is missing", () => {
  expect(() => loadEnv({ ...base, GOD_MODE_PASSWORD: undefined })).toThrow();
});

test("rejects a short session secret", () => {
  expect(() => loadEnv({ ...base, SESSION_SECRET: "short" })).toThrow();
});

test("gateway disabled when no base url, app id defaults", () => {
  const env = loadEnv(base);
  expect(env.gatewayEnabled).toBe(false);
  expect(env.backendApiBaseUrl).toBeUndefined();
  expect(env.backendApiAppId).toBe("42ab2083-5dbd-47fc-bb32-3de97dc0cd89");
  expect(env.backendApiInsecureTls).toBe(false);
});

test("gateway enabled when base url present", () => {
  const env = loadEnv({ ...base, BACKEND_API_BASE_URL: "https://dev.blueledgers.com:4001" });
  expect(env.gatewayEnabled).toBe(true);
  expect(env.backendApiBaseUrl).toBe("https://dev.blueledgers.com:4001");
});

test("insecure tls only true for the literal string 'true'", () => {
  expect(loadEnv({ ...base, BACKEND_API_INSECURE_TLS: "true" }).backendApiInsecureTls).toBe(true);
  expect(loadEnv({ ...base, BACKEND_API_INSECURE_TLS: "false" }).backendApiInsecureTls).toBe(false);
});

test("rejects a non-url base url", () => {
  expect(() => loadEnv({ ...base, BACKEND_API_BASE_URL: "not-a-url" })).toThrow();
});

test("systemDirectUrl defaults to systemDatabaseUrl when SYSTEM_DIRECT_URL unset", () => {
  const env = loadEnv(base);
  expect(env.systemDirectUrl).toBe(base.SYSTEM_DATABASE_URL);
});

test("systemDirectUrl uses SYSTEM_DIRECT_URL when present", () => {
  const env = loadEnv({ ...base, SYSTEM_DIRECT_URL: "postgresql://u:p@direct:5432/postgres" });
  expect(env.systemDirectUrl).toBe("postgresql://u:p@direct:5432/postgres");
});

test("platformPackageDir is undefined by default and passes through when set", () => {
  expect(loadEnv(base).platformPackageDir).toBeUndefined();
  expect(loadEnv({ ...base, BACKSTAGE_PACKAGE_DIR: "/x/pkg" }).platformPackageDir).toBe("/x/pkg");
});

test("allowDangerOps only true for the literal string 'true'", () => {
  expect(loadEnv(base).allowDangerOps).toBe(false);
  expect(loadEnv({ ...base, ALLOW_DANGER_OPS: "true" }).allowDangerOps).toBe(true);
  expect(loadEnv({ ...base, ALLOW_DANGER_OPS: "1" }).allowDangerOps).toBe(false);
});
