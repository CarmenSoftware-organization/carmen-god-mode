import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

afterEach(cleanup);
import type { ReactNode } from "react";
import type { Cluster } from "@/lib/registry";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

const clusters: Cluster[] = [
  { id: "11", code: "CL-A", name: "Alpha", deletedAt: null, businessUnitCount: 2 },
  { id: "22", code: "CL-B", name: "Beta", deletedAt: "2026-06-26 00:00:00+00", businessUnitCount: 0 },
];

function renderTable(C: typeof import("@/components/clusters-table")["ClustersTable"]) {
  return render(<C clusters={clusters} system="CARMEN_SYSTEM" softDeleteAction={vi.fn()} restoreAction={vi.fn()} />);
}

test("active tab shows active clusters and hides deleted ones", async () => {
  const { ClustersTable } = await import("@/components/clusters-table");
  renderTable(ClustersTable);
  expect(screen.getByText("CL-A")).toBeInTheDocument();
  expect(screen.queryByText("CL-B")).not.toBeInTheDocument();
  expect(screen.getByText("Add cluster").closest("a")).toHaveAttribute("href", "/clusters/new");
});

test("editing link points at the dedicated cluster edit route", async () => {
  const { ClustersTable } = await import("@/components/clusters-table");
  renderTable(ClustersTable);
  expect(screen.getByText("Edit").closest("a")).toHaveAttribute("href", "/clusters/11/edit");
});

test("selecting an active row reveals a soft-delete form carrying the pks", async () => {
  const { ClustersTable } = await import("@/components/clusters-table");
  renderTable(ClustersTable);
  fireEvent.click(screen.getByLabelText("Select row 1"));
  const form = screen.getByText("Soft delete 1").closest("form")!;
  const hidden = form.querySelector('input[name="pks"]') as HTMLInputElement;
  expect(hidden.value).toBe(JSON.stringify([{ id: "11" }]));
});

test("deleted tab shows deleted clusters with restore and hard-delete controls", async () => {
  const { ClustersTable } = await import("@/components/clusters-table");
  renderTable(ClustersTable);
  fireEvent.click(screen.getByText(/^Deleted/));
  expect(screen.getByText("CL-B")).toBeInTheDocument();
  expect(screen.queryByText("CL-A")).not.toBeInTheDocument();
  expect(screen.getByText("Hard delete").closest("a")).toHaveAttribute(
    "href",
    `/CARMEN_SYSTEM/tb_cluster/delete?pk=${encodeURIComponent(JSON.stringify({ id: "22" }))}`,
  );
});

test("batch hard delete on the deleted tab targets delete-batch", async () => {
  const { ClustersTable } = await import("@/components/clusters-table");
  renderTable(ClustersTable);
  fireEvent.click(screen.getByText(/^Deleted/));
  fireEvent.click(screen.getByLabelText("Select row 1"));
  expect(screen.getByText("Hard delete 1").closest("a")).toHaveAttribute(
    "href",
    "/CARMEN_SYSTEM/tb_cluster/delete-batch",
  );
});
