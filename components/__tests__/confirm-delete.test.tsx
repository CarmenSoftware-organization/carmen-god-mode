// components/__tests__/confirm-delete.test.tsx
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import type { BlastRadius } from "@/lib/cascade";

const push = vi.fn(); const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const radius: BlastRadius = {
  rows: [{ schema: "CARMEN_SYSTEM", table: "tb_cluster", pk: { id: "1" }, depth: 0 }],
  byTable: [{ schema: "CARMEN_SYSTEM", table: "tb_cluster", count: 1 }],
  maxDepth: 0, truncated: false,
};

test("renders an orphan-schemas drop checkbox listing each schema", async () => {
  const { ConfirmDelete } = await import("@/components/confirm-delete");
  render(<ConfirmDelete schema="CARMEN_SYSTEM" table="tb_cluster" pkJson={JSON.stringify({ id: "1" })}
    radius={radius} isBusinessUnit={false} tenantSchema={null}
    orphanSchemas={["tenant_one", "tenant_two"]} requiredPhrase="DELETE" />);
  expect(screen.getByRole("checkbox")).toBeInTheDocument();
  expect(screen.getByText(/tenant_one/)).toBeInTheDocument();
  expect(screen.getByText(/tenant_two/)).toBeInTheDocument();
});

test("no checkbox when orphanSchemas is empty/absent", async () => {
  const { ConfirmDelete } = await import("@/components/confirm-delete");
  render(<ConfirmDelete schema="CARMEN_SYSTEM" table="tb_cluster" pkJson={JSON.stringify({ id: "1" })}
    radius={radius} isBusinessUnit={false} tenantSchema={null} requiredPhrase="DELETE" />);
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});

test("stamping the seal POSTs the normalized payload to the cascade-delete route", async () => {
  const fetchMock = vi.fn(async () => {
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(enc.encode(JSON.stringify({ type: "done", summary: "ok", redirect: "/clusters" }) + "\n")); c.close(); },
    });
    return new Response(body, { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);

  const { ConfirmDelete } = await import("@/components/confirm-delete");
  render(<ConfirmDelete schema="CARMEN_SYSTEM" table="tb_cluster" pkJson={JSON.stringify({ id: "1" })}
    radius={radius} isBusinessUnit={false} tenantSchema={null} requiredPhrase="DELETE" />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "DELETE" } });
  fireEvent.mouseDown(screen.getByRole("button", { name: /confirm/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 2000 });
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("/api/ops/cascade-delete");
  expect(JSON.parse(String(init.body))).toEqual({
    schema: "CARMEN_SYSTEM", table: "tb_cluster", pks: [{ id: "1" }], dropSchema: false, confirm: "DELETE",
  });
});

test("a pool warning blocks the schema drop while leaving the row delete available", async () => {
  const { ConfirmDelete } = await import("@/components/confirm-delete");
  render(<ConfirmDelete schema="CARMEN_SYSTEM" table="tb_business_unit" pkJson={JSON.stringify({ id: "1" })}
    radius={radius} isBusinessUnit tenantSchema="tenant_elsewhere"
    poolWarning="T02 (tenant_elsewhere) → prod.example.com:5432/carmen"
    requiredPhrase="DELETE" />);
  // The blast-radius callout is also role="alert", so match this one by its title.
  expect(screen.getByText("Tenant schema lives on another database")).toBeInTheDocument();
  expect(screen.getByText(/prod\.example\.com:5432\/carmen/)).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: /all tenant data/i })).toBeDisabled();
  expect(screen.getByRole("radio", { name: /configuration only/i })).toBeChecked();
});

test("without a pool warning the schema drop stays operable", async () => {
  const { ConfirmDelete } = await import("@/components/confirm-delete");
  render(<ConfirmDelete schema="CARMEN_SYSTEM" table="tb_business_unit" pkJson={JSON.stringify({ id: "1" })}
    radius={radius} isBusinessUnit tenantSchema="tenant_here" requiredPhrase="DELETE" />);
  expect(screen.queryByText("Tenant schema lives on another database")).not.toBeInTheDocument();
  expect(screen.getByRole("radio", { name: /all tenant data/i })).toBeEnabled();
});
