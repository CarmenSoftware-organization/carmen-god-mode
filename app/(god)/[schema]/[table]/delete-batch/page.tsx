import { SchemaBanner } from "@/components/schema-banner";
import { BatchDeleteLoader } from "@/components/batch-delete-loader";

export const dynamic = "force-dynamic";

// The selection arrives via sessionStorage (lib/batch-selection), not ?pks= — a URL
// carrying ~100 UUIDs overflows the 16KB request-header cap and 431s.
export default async function DeleteBatchPage({
  params,
}: { params: Promise<{ schema: string; table: string }> }) {
  const { schema, table } = await params;
  return (
    <div className="space-y-4">
      <SchemaBanner schema={schema} />
      <BatchDeleteLoader schema={schema} table={table} />
    </div>
  );
}
