import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAuth = vi.fn();
const applyInsert = vi.fn();
const applyUpdate = vi.fn();
const softDeleteRows = vi.fn();
const restoreRows = vi.fn();
const valuesFromForm = vi.fn();
const describeTable = vi.fn();

vi.mock("@/lib/session", () => ({ requireAuth: () => requireAuth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: () => ({ systemSchemaName: "CARMEN_SYSTEM", godModeUserId: null }) }));
vi.mock("@/lib/introspect", () => ({ describeTable: (...a: unknown[]) => describeTable(...a) }));
vi.mock("@/lib/write", () => ({
  applyInsert: (...a: unknown[]) => applyInsert(...a),
  applyUpdate: (...a: unknown[]) => applyUpdate(...a),
}));
vi.mock("@/lib/soft-delete", () => ({
  softDeleteRows: (...a: unknown[]) => softDeleteRows(...a),
  restoreRows: (...a: unknown[]) => restoreRows(...a),
}));
vi.mock("@/lib/form-values", async () => {
  const actual = await vi.importActual<typeof import("@/lib/form-values")>("@/lib/form-values");
  return { ...actual, valuesFromForm: (...a: unknown[]) => valuesFromForm(...a) };
});

import * as rows from "@/server/rows";
import * as clusters from "@/server/cluster-actions";

const fd = () => {
  const f = new FormData();
  f.set("pks", '[{"id":1}]');
  return f;
};

const calls: [string, () => Promise<unknown>][] = [
  ["submitInsert", () => rows.submitInsert("app", "item", fd())],
  ["submitUpdate", () => rows.submitUpdate("app", "item", '{"id":1}', fd())],
  ["softDeleteClusters", () => clusters.softDeleteClusters(fd())],
  ["restoreClusters", () => clusters.restoreClusters(fd())],
  ["submitClusterInsert", () => clusters.submitClusterInsert(fd())],
  ["submitClusterUpdate", () => clusters.submitClusterUpdate('{"id":1}', fd())],
];

beforeEach(() => {
  vi.clearAllMocks();
  valuesFromForm.mockResolvedValue({});
  describeTable.mockResolvedValue({ columns: [], primaryKey: ["id"] });
});

describe("row actions require auth", () => {
  test.each(calls)("%s rejects when unauthenticated and touches nothing", async (_n, call) => {
    requireAuth.mockRejectedValue(new Error("Unauthorized"));
    await expect(call()).rejects.toThrow("Unauthorized");
    for (const fn of [applyInsert, applyUpdate, softDeleteRows, restoreRows, valuesFromForm]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });
});

describe("hostile pkJson", () => {
  beforeEach(() => requireAuth.mockResolvedValue(undefined));

  test("submitUpdate rejects empty pk object", async () => {
    await expect(rows.submitUpdate("app", "item", "{}", fd())).rejects.toThrow(/invalid primary key/i);
    expect(applyUpdate).not.toHaveBeenCalled();
  });

  test("submitClusterUpdate rejects non-JSON pk", async () => {
    await expect(clusters.submitClusterUpdate("not json", fd())).rejects.toThrow(/invalid primary key/i);
    expect(applyUpdate).not.toHaveBeenCalled();
  });
});

describe("tampered pkJson with real non-PK columns", () => {
  beforeEach(() => requireAuth.mockResolvedValue(undefined));

  test("submitUpdate rejects pk that is not the table primary key", async () => {
    await expect(rows.submitUpdate("app", "item", '{"status":"active"}', fd())).rejects.toThrow(/invalid primary key/i);
    expect(applyUpdate).not.toHaveBeenCalled();
    expect(valuesFromForm).not.toHaveBeenCalled();
  });

  test("submitClusterUpdate rejects pk that is not the table primary key", async () => {
    await expect(clusters.submitClusterUpdate('{"status":"active"}', fd())).rejects.toThrow(/invalid primary key/i);
    expect(applyUpdate).not.toHaveBeenCalled();
    expect(valuesFromForm).not.toHaveBeenCalled();
  });

  test("submitUpdate accepts the exact primary key", async () => {
    await rows.submitUpdate("app", "item", '{"id":1}', fd());
    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });
});

test("server/rows.ts does not export valuesFromForm", () => {
  expect("valuesFromForm" in rows).toBe(false);
});
