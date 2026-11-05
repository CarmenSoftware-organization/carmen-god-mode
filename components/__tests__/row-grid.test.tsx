import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

afterEach(cleanup);
import type { ReactNode } from "react";
import type { RowPage } from "@/lib/rows";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

const page: RowPage = {
  columns: [{ name: "id", dataType: "integer", udtName: "int4", isNullable: false, default: null, isPrimaryKey: true }],
  primaryKey: ["id"],
  rows: [{ id: 1 }, { id: 2 }],
  nextCursor: null,
};

test("no Delete-selected control until a row is checked", async () => {
  const { RowGrid } = await import("@/components/row-grid");
  render(<RowGrid schema="app" table="t" page={page} />);
  expect(screen.queryByText(/Delete .* selected/)).not.toBeInTheDocument();
});

test("checking a row reveals Delete N selected with the correct href", async () => {
  const { RowGrid } = await import("@/components/row-grid");
  render(<RowGrid schema="app" table="t" page={page} />);
  fireEvent.click(screen.getByLabelText("Select row 1"));
  const link = screen.getByText("Delete 1").closest("a")!;
  expect(link).toHaveAttribute("href", "/app/t/delete-batch");
});

test("select-all checks every row on the page", async () => {
  const { RowGrid } = await import("@/components/row-grid");
  render(<RowGrid schema="app" table="t" page={page} />);
  fireEvent.click(screen.getByLabelText("Select all rows"));
  expect(screen.getByText("Delete 2")).toBeInTheDocument();
});
