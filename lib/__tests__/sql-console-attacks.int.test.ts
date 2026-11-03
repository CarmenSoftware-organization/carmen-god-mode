import { afterAll, beforeAll, expect, test, vi } from "vitest";
import type { Pg } from "@/test/pg";
import { startPg } from "@/test/pg";

let container: Pg;
const AUDIT = `"CARMEN_SYSTEM".tb_god_mode_audit`;

vi.mock("@/lib/session", () => ({
  getSession: async () => ({ actor: "tester", authed: true }),
  requireAuth: async () => {},
}));

async function q<T>(text: string): Promise<T[]> {
  const { getSql } = await import("@/lib/db");
  return (await getSql().unsafe(text)) as unknown as T[];
}
const itemCount = async () => (await q<{ n: number }>(`SELECT count(*)::int n FROM app.item`))[0].n;
const auditCount = async () => (await q<{ n: number }>(`SELECT count(*)::int n FROM ${AUDIT}`))[0].n;
const regclass = async (name: string) =>
  (await q<{ r: string | null }>(`SELECT to_regclass('${name}')::text r`))[0].r;
const seqLast = async () => (await q<{ v: string }>(`SELECT last_value::text v FROM app.seq_t_id_seq`))[0].v;

beforeAll(async () => {
  const pg = await startPg();
  container = pg.container;
  process.env.DATABASE_URL = pg.url;
  process.env.SYSTEM_DATABASE_URL = pg.url;
  process.env.SYSTEM_SCHEMA_NAME = "CARMEN_SYSTEM";
  process.env.GOD_MODE_PASSWORD = "x";
  process.env.SESSION_SECRET = "x".repeat(32);
  await q(`
    CREATE SCHEMA "CARMEN_SYSTEM"; CREATE SCHEMA app;
    CREATE TABLE app.item (id int primary key, name text);
    INSERT INTO app.item VALUES (1,'a'),(2,'b'),(3,'c');
    CREATE TABLE app.seq_t (id serial primary key, v int);
  `);
  const { ensureAuditTable } = await import("@/lib/audit");
  await ensureAuditTable();
});
afterAll(async () => { await container.stop(); });

async function expectRejectedUnchanged(fn: () => Promise<unknown>, message: RegExp) {
  const a0 = await auditCount();
  await expect(fn()).rejects.toThrow(message);
  expect(await itemCount()).toBe(3);
  expect(await auditCount()).toBe(a0);
}

test("runSql rejects multi-statement SELECT; DELETE", async () => {
  const { runSql } = await import("@/server/sql");
  await expectRejectedUnchanged(() => runSql("app", "SELECT 1; DELETE FROM item"), /multiple commands/i);
});

test("runSql rejects SELECT 1; COMMIT; DELETE", async () => {
  const { runSql } = await import("@/server/sql");
  await expectRejectedUnchanged(() => runSql("app", "SELECT 1; COMMIT; DELETE FROM item"), /multiple commands/i);
});

test("applySql rejects multi-statement on the write path", async () => {
  const { applySql } = await import("@/server/sql");
  await expectRejectedUnchanged(() =>
    applySql("app", "DELETE FROM item WHERE id=1; DELETE FROM item"), /multiple commands/i);
});

test("runSql rejects SELECT INTO (read-only tx)", async () => {
  const { runSql } = await import("@/server/sql");
  await expectRejectedUnchanged(() => runSql("app", "SELECT * INTO item_copy FROM item"), /read-only transaction/i);
  expect(await regclass("app.item_copy")).toBeNull();
});

test("runSql rejects setval and leaves sequence unchanged", async () => {
  const { runSql } = await import("@/server/sql");
  const before = await seqLast();
  await expectRejectedUnchanged(() =>
    runSql("app", "SELECT setval(pg_get_serial_sequence('app.seq_t','id'), 999)"), /read-only transaction/i);
  expect(await seqLast()).toBe(before);
});

test("runSql rejects pg_terminate_backend with ConsoleSqlRejected; connection still works", async () => {
  const { runSql } = await import("@/server/sql");
  const { ConsoleSqlRejected } = await import("@/lib/sql-guard");
  await expect(runSql("app", "SELECT pg_terminate_backend(pg_backend_pid())"))
    .rejects.toSatisfy((e: unknown) => e instanceof ConsoleSqlRejected && /pg_terminate_backend/.test(e.message));
  const r = await runSql("app", "SELECT 1");
  expect(r.kind).toBe("read");
  expect(await itemCount()).toBe(3);
});

test("regression: trailing semicolon is a read", async () => {
  const { runSql } = await import("@/server/sql");
  const r = await runSql("app", "SELECT 1;");
  expect(r.kind).toBe("read");
});

test("regression: semicolon inside a string literal", async () => {
  const { runSql } = await import("@/server/sql");
  const r = await runSql("app", "SELECT 'a;b' AS v");
  expect(r.kind).toBe("read");
  if (r.kind === "read") expect(r.rows[0].v).toBe("a;b");
});

test("regression: DELETE preview then apply", async () => {
  const { runSql, applySql } = await import("@/server/sql");
  const a0 = await auditCount();
  try {
  const p = await runSql("app", "DELETE FROM item WHERE id=1");
  expect(p.kind).toBe("write-preview");
  if (p.kind === "write-preview") expect(p.affected).toBe(1);
  expect(await itemCount()).toBe(3);
  expect(await auditCount()).toBe(a0);

  const a = await applySql("app", "DELETE FROM item WHERE id=1");
  expect(a.kind).toBe("write-applied");
  if (a.kind === "write-applied") expect(a.affected).toBe(1);
  expect(await itemCount()).toBe(2);
  expect(await auditCount()).toBe(a0 + 1);
  expect(await itemCount()).toBe(2);
  } finally {
    await q(`INSERT INTO app.item VALUES (1,'a') ON CONFLICT DO NOTHING`);
  }
  expect(await itemCount()).toBe(3);
});

test("DDL: preview rolls back, apply persists and audits", async () => {
  const { runSql, applySql } = await import("@/server/sql");
  const a0 = await auditCount();
  const p = await runSql("app", "CREATE TABLE ddl_t(a int)");
  expect(p.kind).toBe("write-preview");
  expect(await regclass("app.ddl_t")).toBeNull();
  const a = await applySql("app", "CREATE TABLE ddl_t(a int)");
  expect(a.kind).toBe("write-applied");
  expect(await regclass("app.ddl_t")).not.toBeNull();
  expect(await auditCount()).toBe(a0 + 1);
  await q(`DROP TABLE IF EXISTS app.ddl_t`);
});
