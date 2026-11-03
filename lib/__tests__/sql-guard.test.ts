import { describe, expect, test } from "vitest";
import { ident, qualified, classifyStatement, checkConsoleStatement, ConsoleSqlRejected } from "@/lib/sql-guard";

test("ident quotes a normal name", () => {
  expect(ident("tb_user")).toBe('"tb_user"');
});

test("ident preserves case and escapes embedded quotes", () => {
  expect(ident("CARMEN_SYSTEM")).toBe('"CARMEN_SYSTEM"');
  expect(ident('we"ird')).toBe('"we""ird"');
});

test("ident rejects dangerous names", () => {
  expect(() => ident("")).toThrow();
  expect(() => ident("a".repeat(64))).toThrow();
  expect(() => ident("a\0b")).toThrow();
});

test("qualified joins schema and table", () => {
  expect(qualified("CARMEN_SYSTEM", "tb_business_unit")).toBe('"CARMEN_SYSTEM"."tb_business_unit"');
});

test("classifyStatement detects reads", () => {
  expect(classifyStatement("SELECT * FROM t")).toBe("read");
  expect(classifyStatement("  -- c\n  select 1")).toBe("read");
  expect(classifyStatement("WITH x AS (SELECT 1) SELECT * FROM x")).toBe("read");
  expect(classifyStatement("EXPLAIN SELECT 1")).toBe("read");
});

test("classifyStatement detects writes", () => {
  expect(classifyStatement("UPDATE t SET a=1")).toBe("write");
  expect(classifyStatement("DELETE FROM t")).toBe("write");
  expect(classifyStatement("DROP TABLE t")).toBe("write");
  expect(classifyStatement("EXPLAIN ANALYZE DELETE FROM t")).toBe("write");
  expect(classifyStatement("WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x")).toBe("write");
});

describe("checkConsoleStatement", () => {
  test.each([
    "SELECT 1", "-- c\nSELECT 1", "/* c */ select 1", "WITH x AS (SELECT 1) SELECT * FROM x",
    "TABLE t", "VALUES (1)", "EXPLAIN SELECT 1", "SHOW search_path", "(SELECT 1)",
    "SELECT 1 AS pg_sleep_count",
  ])("read: %s", (q) => {
    expect(checkConsoleStatement(q)).toBe("read");
  });

  test.each([
    "INSERT INTO t VALUES (1)", "update t set a=1", "DELETE FROM t",
    "MERGE INTO t USING s ON true WHEN MATCHED THEN DELETE",
    "WITH d AS (DELETE FROM t RETURNING *) SELECT * FROM d",
    "CREATE INDEX i ON t(a)", "ALTER TABLE t ADD COLUMN b int", "DROP TABLE t", "TRUNCATE t",
    "GRANT SELECT ON t TO x", "REVOKE SELECT ON t FROM x", "COMMENT ON TABLE t IS 'x'",
    "EXPLAIN ANALYZE SELECT 1",
  ])("write: %s", (q) => {
    expect(checkConsoleStatement(q)).toBe("write");
  });

  test.each([
    "", "   ", "BEGIN", "COMMIT", "ROLLBACK", "END", "ABORT", "SAVEPOINT s", "RELEASE s",
    "START TRANSACTION", "PREPARE TRANSACTION 'x'", "COPY t TO PROGRAM 'x'", "COPY t FROM STDIN",
    "SET search_path TO x", "RESET ALL", "DISCARD ALL", "DO $$BEGIN END$$", "CALL p()",
    "LISTEN c", "NOTIFY c", "VACUUM", "LOCK TABLE t",
  ])("rejects disallowed statement: %j", (q) => {
    expect(() => checkConsoleStatement(q)).toThrow(ConsoleSqlRejected);
  });

  test.each([
    "SELECT pg_terminate_backend(1)", "select PG_CANCEL_BACKEND(1)",
    "SELECT pg_catalog.pg_terminate_backend(1)", 'SELECT "pg_terminate_backend"(1)',
    'SELECT pg_catalog."pg_sleep" (1)', "SELECT pg_sleep_for('1s')", "SELECT pg_advisory_xact_lock(1)",
    "SELECT set_config('a','b',false)", "SELECT dblink_exec('x','y')", "SELECT lo_unlink(1)",
    "SELECT pg_read_file('/etc/passwd')", "UPDATE t SET a = pg_reload_conf()",
  ])("rejects denylisted function: %s", (q) => {
    expect(() => checkConsoleStatement(q)).toThrow(ConsoleSqlRejected);
  });
});
