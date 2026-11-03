import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

beforeAll(() => {
  process.env.SYSTEM_DATABASE_URL = "postgresql://u:p@h:6432/carmen_platform";
  process.env.DATABASE_URL = "postgresql://u:p@h:6432/carmen_platform";
  process.env.SYSTEM_SCHEMA_NAME = "CARMEN_SYSTEM";
  process.env.GOD_MODE_PASSWORD = "x";
  process.env.SESSION_SECRET = "x".repeat(32);
  delete process.env.ALLOW_DANGER_OPS;
});

vi.mock("@/lib/session", () => ({ requireAuth: vi.fn(async () => ({ authed: true, actor: "op" })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const executeCascade = vi.fn(async () => ({ deleted: 1, droppedSchemas: [] }));
const executeCascadeMany = vi.fn(async () => ({ deleted: 1 }));
vi.mock("@/lib/cascade", () => ({
  executeCascade: () => executeCascade(),
  executeCascadeMany: () => executeCascadeMany(),
}));
vi.mock("@/lib/registry", () => ({
  resolveTenantSchema: vi.fn(async () => null),
  resolveTenantSchemasForCluster: vi.fn(async () => []),
  listBusinessUnits: vi.fn(async () => []),
}));
vi.mock("@/lib/db-pool", () => ({
  loadPoolsForBusinessUnits: vi.fn(async () => []),
  loadPoolsForCluster: vi.fn(async () => []),
  tenantDropBlockReason: vi.fn(() => null),
}));

const executeDropSchema = vi.fn(async () => ({ droppedSchema: "x" }));
vi.mock("@/lib/drop-schema", () => ({
  executeDropSchema: () => executeDropSchema(),
  isProtectedSchema: (s: string) => s === "CARMEN_SYSTEM" || s === "public",
}));

vi.mock("@/lib/audit", () => ({ ensureAuditTable: vi.fn(async () => {}), writeAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/db", () => ({ withTransaction: vi.fn(async (_s: unknown, fn: (tx: unknown) => unknown) => fn({})) }));
vi.mock("@/lib/introspect", () => ({ listSchemaNames: vi.fn(async () => ["CARMEN_SYSTEM", "public"]) }));
vi.mock("@/lib/schema-bootstrap", () => ({ ensureSchemaExists: vi.fn(async () => {}) }));
vi.mock("@/lib/platform-package", () => ({
  assertPackageDir: vi.fn(async () => {}),
  assertPsql: vi.fn(async () => {}),
  buildSubprocessEnv: vi.fn(() => ({})),
  packageDir: vi.fn(() => "/pkg"),
  targetDbInfo: vi.fn(() => ({ masked: "m" })),
  listTenantFiles: vi.fn(async () => []),
}));
const runProcess = vi.fn(async () => ({ code: 0 }));
vi.mock("@/lib/run-process", () => ({ runProcess: () => runProcess() }));

beforeEach(() => vi.clearAllMocks());

const mk = (path: string, raw: string) =>
  new Request(`http://test/api/ops/${path}`, { method: "POST", body: raw });

const routes: Record<string, () => Promise<(r: Request) => Promise<Response>>> = {
  "cascade-delete": async () => (await import("@/app/api/ops/cascade-delete/route")).POST,
  "drop-schema": async () => (await import("@/app/api/ops/drop-schema/route")).POST,
  "platform-migrate": async () => (await import("@/app/api/ops/platform-migrate/route")).POST,
};

function executorsCalled(): boolean {
  return executeCascade.mock.calls.length + executeCascadeMany.mock.calls.length +
    executeDropSchema.mock.calls.length + runProcess.mock.calls.length > 0;
}

describe.each(Object.keys(routes))("%s", (name) => {
  test.each(["not json", "[]", "null", "42"])("body %j -> 400 with error", async (raw) => {
    const POST = await routes[name]();
    const res = await POST(mk(name, raw));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: unknown };
    expect(typeof json.error).toBe("string");
    expect(executorsCalled()).toBe(false);
  });
});

test("cascade-delete: pks as a string -> 400", async () => {
  const POST = await routes["cascade-delete"]();
  const res = await POST(mk("cascade-delete", JSON.stringify({ schema: "s", table: "t", pks: "x", confirm: "DELETE" })));
  expect(res.status).toBe(400);
  expect(executorsCalled()).toBe(false);
});

test("drop-schema: numeric schema -> 400", async () => {
  const POST = await routes["drop-schema"]();
  const res = await POST(mk("drop-schema", JSON.stringify({ schema: 123, confirm: "123" })));
  expect(res.status).toBe(400);
  expect(executorsCalled()).toBe(false);
});

test("platform-migrate: numeric opId -> 4xx", async () => {
  const POST = await routes["platform-migrate"]();
  const res = await POST(mk("platform-migrate", JSON.stringify({ opId: 5, schema: "public" })));
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(res.status).toBeLessThan(500);
  expect(executorsCalled()).toBe(false);
});

describe("wrong-typed fields -> 400, nothing executed", () => {
  const cases: [string, unknown][] = [
    ["platform-migrate", { opId: "prisma-status", schema: 123 }],
    ["platform-migrate", { opId: "prisma-status", schema: "public", bu: 1 }],
    ["platform-migrate", { opId: "prisma-status", schema: "public", only: 1 }],
    ["platform-migrate", { opId: "prisma-status", schema: "public", confirm: 1 }],
    ["platform-migrate", { opId: "prisma-status", schema: "public", confirmDestroy: "yes" }],
    ["platform-migrate", { opId: "prisma-status", schema: "public", confirmCreateSchema: "yes" }],
    ["cascade-delete", { schema: 1, table: 2, pks: [{}], confirm: "DELETE" }],
    ["cascade-delete", { schema: "s", table: "t", pks: [null], confirm: "DELETE" }],
    ["cascade-delete", { schema: "s", table: "t", pks: [[]], confirm: "DELETE" }],
    ["cascade-delete", { schema: "s", table: "t", pks: [{}], confirm: 5 }],
    ["cascade-delete", { schema: "s", table: "t", pks: [{}], dropSchema: "yes", confirm: "DELETE" }],
    ["cascade-delete", { schema: "CARMEN_SYSTEM", table: "tb_business_unit", pks: [null], dropSchema: true, confirm: "DELETE" }],
    ["drop-schema", { schema: "tenant_x", confirm: 5 }],
  ];
  test.each(cases)("%s %j", async (name, body) => {
    const POST = await routes[name]();
    const res = await POST(mk(name, JSON.stringify(body)));
    expect(res.status).toBe(400);
    expect(executorsCalled()).toBe(false);
  });
});
