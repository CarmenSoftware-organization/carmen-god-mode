import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

afterEach(cleanup);
import type { ReactNode } from "react";
import type { BusinessUnit } from "@/lib/registry";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

const bus: BusinessUnit[] = [
  { id: "11", code: "BU-A", name: "Alpha", clusterId: null, isActive: true, tenantSchema: "tenant_a" },
  { id: "22", code: "BU-B", name: "Beta", clusterId: null, isActive: false, tenantSchema: null },
];

test("rows render with code and name", async () => {
  const { BusinessUnitsTable } = await import("@/components/business-units-table");
  render(<BusinessUnitsTable bus={bus} system="CARMEN_SYSTEM" />);
  expect(screen.getByText("BU-A")).toBeInTheDocument();
  expect(screen.getByText("Beta")).toBeInTheDocument();
});

test("no Delete-selected control until a row is checked", async () => {
  const { BusinessUnitsTable } = await import("@/components/business-units-table");
  render(<BusinessUnitsTable bus={bus} system="CARMEN_SYSTEM" />);
  expect(screen.queryByText(/Delete .* selected/)).not.toBeInTheDocument();
});

test("checking a row reveals Delete N selected with the delete-batch href", async () => {
  const { BusinessUnitsTable } = await import("@/components/business-units-table");
  render(<BusinessUnitsTable bus={bus} system="CARMEN_SYSTEM" />);
  fireEvent.click(screen.getByLabelText("Select row 1"));
  const link = screen.getByText("Delete 1").closest("a")!;
  expect(link).toHaveAttribute(
    "href",
    "/CARMEN_SYSTEM/tb_business_unit/delete-batch",
  );
});

test("select-all checks every business unit", async () => {
  const { BusinessUnitsTable } = await import("@/components/business-units-table");
  render(<BusinessUnitsTable bus={bus} system="CARMEN_SYSTEM" />);
  fireEvent.click(screen.getByLabelText("Select all"));
  expect(screen.getByText("Delete 2")).toBeInTheDocument();
});

test("per-row delete and open links preserved", async () => {
  const { BusinessUnitsTable } = await import("@/components/business-units-table");
  render(<BusinessUnitsTable bus={bus} system="CARMEN_SYSTEM" />);
  expect(screen.getByText("Open").closest("a")).toHaveAttribute("href", "/tenant_a/tables");
  const del = screen.getAllByText("Delete")[0].closest("a")!;
  expect(del).toHaveAttribute(
    "href",
    `/CARMEN_SYSTEM/tb_business_unit/delete?pk=${encodeURIComponent(JSON.stringify({ id: "11" }))}`,
  );
});

test("a business unit on another database is badged in the schema column", async () => {
  const { BusinessUnitsTable } = await import("@/components/business-units-table");
  render(<BusinessUnitsTable bus={bus} system="CARMEN_SYSTEM" poolMismatchIds={["11"]} />);
  expect(screen.getByText("other database")).toBeInTheDocument();
});

test("no badge when every business unit sits on the connected database", async () => {
  const { BusinessUnitsTable } = await import("@/components/business-units-table");
  render(<BusinessUnitsTable bus={bus} system="CARMEN_SYSTEM" />);
  expect(screen.queryByText("other database")).not.toBeInTheDocument();
});
