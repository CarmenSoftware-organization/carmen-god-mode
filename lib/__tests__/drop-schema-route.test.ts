import { afterEach, expect, test, vi } from "vitest";

vi.mock("@/lib/session", () => ({ requireAuth: vi.fn(async () => {}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const executeDropSchema = vi.fn(async (...args: unknown[]) => ({ droppedSchema: String(args[0]) }));
vi.mock("@/lib/drop-schema", () => ({
  executeDropSchema: (schema: string, opts?: unknown) => executeDropSchema(schema, opts),
  isProtectedSchema: (s: string) => s === "CARMEN_SYSTEM" || s === "public",
  inUseReason: async () => null,
}));

afterEach(() => vi.clearAllMocks());

async function post(body: unknown): Promise<Response> {
  const { POST } = await import("@/app/api/ops/drop-schema/route");
  return POST(
    new Request("http://test/api/ops/drop-schema", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

test("401 when unauthenticated", async () => {
  const { requireAuth } = await import("@/lib/session");
  vi.mocked(requireAuth).mockRejectedValueOnce(new Error("unauth"));
  const res = await post({ schema: "tenant_x", confirm: "tenant_x" });
  expect(res.status).toBe(401);
  expect(executeDropSchema).not.toHaveBeenCalled();
});

test("400 refuses the system schema (before any drop)", async () => {
  const res = await post({ schema: "CARMEN_SYSTEM", confirm: "CARMEN_SYSTEM" });
  expect(res.status).toBe(400);
  expect(executeDropSchema).not.toHaveBeenCalled();
});

test("400 refuses the public schema (before any drop)", async () => {
  const res = await post({ schema: "public", confirm: "public" });
  expect(res.status).toBe(400);
  expect(executeDropSchema).not.toHaveBeenCalled();
});

test("400 when the confirm phrase is not the schema name", async () => {
  const res = await post({ schema: "tenant_x", confirm: "DELETE" });
  expect(res.status).toBe(400);
  expect(executeDropSchema).not.toHaveBeenCalled();
});

test("400 when no schema is given", async () => {
  const res = await post({ schema: "", confirm: "" });
  expect(res.status).toBe(400);
  expect(executeDropSchema).not.toHaveBeenCalled();
});

test("streams a done event and drops when auth + confirm phrase match", async () => {
  const res = await post({ schema: "tenant_x", confirm: "tenant_x" });
  expect(res.status).toBe(200);
  const text = await res.text();
  expect(executeDropSchema).toHaveBeenCalledWith("tenant_x", expect.anything());
  expect(text).toContain("Dropped schema tenant_x");
});
