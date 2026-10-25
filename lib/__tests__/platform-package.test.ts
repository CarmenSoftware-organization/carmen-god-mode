import { afterEach, beforeEach, expect, test, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const base = {
  SYSTEM_DATABASE_URL: "postgresql://carmen_user:s3cret@db.example.com:6432/carmen_platform",
  DATABASE_URL: "postgresql://carmen_user:s3cret@db.example.com:6432/carmen_platform",
  SYSTEM_SCHEMA_NAME: "CARMEN_SYSTEM",
  GOD_MODE_PASSWORD: "x",
  SESSION_SECRET: "x".repeat(32),
};

beforeEach(() => { Object.assign(process.env, base); });
afterEach(() => { vi.resetModules(); for (const k of ["SYSTEM_DIRECT_URL", "BACKSTAGE_PACKAGE_DIR"]) delete process.env[k]; });

test("targetDbInfo parses host/database/schema and masks the password", async () => {
  vi.resetModules();
  const { targetDbInfo } = await import("@/lib/platform-package");
  const t = targetDbInfo();
  expect(t.host).toBe("db.example.com:6432");
  expect(t.database).toBe("carmen_platform");
  expect(t.schema).toBe("CARMEN_SYSTEM");
  expect(t.masked).toBe("postgresql://carmen_user@db.example.com:6432/carmen_platform");
  expect(t.masked).not.toContain("s3cret");
});

test("withSchemaParam sets/replaces the schema query param and preserves others", async () => {
  vi.resetModules();
  const { withSchemaParam } = await import("@/lib/platform-package");
  expect(withSchemaParam("postgresql://u:p@h:6432/db", "CARMEN_SYSTEM"))
    .toBe("postgresql://u:p@h:6432/db?schema=CARMEN_SYSTEM");
  expect(withSchemaParam("postgresql://u:p@h:6432/db?schema=OLD", "NEW_ENV"))
    .toBe("postgresql://u:p@h:6432/db?schema=NEW_ENV");
  expect(withSchemaParam("postgresql://u:p@h:6432/db?sslmode=require", "S"))
    .toBe("postgresql://u:p@h:6432/db?sslmode=require&schema=S");
});

test("buildSubprocessEnv injects ?schema= into both URLs and sets SYSTEM_SCHEMA_NAME", async () => {
  vi.resetModules();
  const { buildSubprocessEnv } = await import("@/lib/platform-package");
  const e = buildSubprocessEnv("CARMEN_SYSTEM");
  expect(e.SYSTEM_DATABASE_URL).toBe(`${base.SYSTEM_DATABASE_URL}?schema=CARMEN_SYSTEM`);
  expect(e.SYSTEM_DIRECT_URL).toBe(`${base.SYSTEM_DATABASE_URL}?schema=CARMEN_SYSTEM`);
  expect(e.SYSTEM_SCHEMA_NAME).toBe("CARMEN_SYSTEM");
});

test("assertPackageDir resolves when package.json exists and throws otherwise", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pkg-"));
  await fs.writeFile(path.join(dir, "package.json"), "{}");
  process.env.BACKSTAGE_PACKAGE_DIR = dir;
  vi.resetModules();
  const { assertPackageDir, packageDir } = await import("@/lib/platform-package");
  expect(packageDir()).toBe(dir);
  await expect(assertPackageDir()).resolves.toBeUndefined();

  process.env.BACKSTAGE_PACKAGE_DIR = path.join(dir, "does-not-exist");
  vi.resetModules();
  const mod = await import("@/lib/platform-package");
  await expect(mod.assertPackageDir()).rejects.toThrow(/not found/);
});

test("listTenantFiles returns sorted *.up.sql basenames", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pkg-"));
  await fs.mkdir(path.join(dir, "migrations", "tenant"), { recursive: true });
  await fs.writeFile(path.join(dir, "migrations", "tenant", "002_b.up.sql"), "");
  await fs.writeFile(path.join(dir, "migrations", "tenant", "001_a.up.sql"), "");
  await fs.writeFile(path.join(dir, "migrations", "tenant", "001_a.down.sql"), "");
  process.env.BACKSTAGE_PACKAGE_DIR = dir;
  vi.resetModules();
  const { listTenantFiles } = await import("@/lib/platform-package");
  expect(await listTenantFiles()).toEqual(["001_a.up.sql", "002_b.up.sql"]);
});

test("readPackageScripts returns the scripts map from package.json", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pkg-"));
  await fs.writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({ scripts: { "db:seed": "ts-node prisma/seed.ts" } }),
  );
  process.env.BACKSTAGE_PACKAGE_DIR = dir;
  vi.resetModules();
  const { readPackageScripts } = await import("@/lib/platform-package");
  expect(await readPackageScripts()).toEqual({ "db:seed": "ts-node prisma/seed.ts" });
});

test("readPackageScripts returns null when package.json is absent", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pkg-"));
  process.env.BACKSTAGE_PACKAGE_DIR = dir;
  vi.resetModules();
  const { readPackageScripts } = await import("@/lib/platform-package");
  expect(await readPackageScripts()).toBeNull();
});

test("readPackageScripts returns null when package.json has no scripts key", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pkg-"));
  await fs.writeFile(path.join(dir, "package.json"), "{}");
  process.env.BACKSTAGE_PACKAGE_DIR = dir;
  vi.resetModules();
  const { readPackageScripts } = await import("@/lib/platform-package");
  expect(await readPackageScripts()).toBeNull();
});
