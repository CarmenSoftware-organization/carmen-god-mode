import { beforeEach, expect, test, vi } from "vitest";

const runRead = vi.fn();
const previewWrite = vi.fn();
const applyWrite = vi.fn();

vi.mock("@/lib/session", () => ({
  requireAuth: vi.fn(async () => {
    throw new Error("Unauthorized");
  }),
}));
vi.mock("@/lib/sql-runner", () => ({ runRead, previewWrite, applyWrite }));

beforeEach(() => {
  runRead.mockReset();
  previewWrite.mockReset();
  applyWrite.mockReset();
});

test("runSql rejects when unauthenticated and calls no runner", async () => {
  const { runSql } = await import("@/server/sql");
  await expect(runSql("app", "SELECT 1")).rejects.toThrow();
  expect(runRead).not.toHaveBeenCalled();
  expect(previewWrite).not.toHaveBeenCalled();
  expect(applyWrite).not.toHaveBeenCalled();
});

test("applySql rejects when unauthenticated and calls no runner", async () => {
  const { applySql } = await import("@/server/sql");
  await expect(applySql("app", "SELECT 1")).rejects.toThrow();
  expect(runRead).not.toHaveBeenCalled();
  expect(previewWrite).not.toHaveBeenCalled();
  expect(applyWrite).not.toHaveBeenCalled();
});
