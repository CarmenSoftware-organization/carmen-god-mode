import { notFound } from "next/navigation";
import { listSchemaNames } from "@/lib/introspect";
import { inUseReason, protectedReason } from "@/lib/drop-schema";
import { DropSchemaConfirm } from "@/components/drop-schema-confirm";
import { SchemaBanner } from "@/components/schema-banner";

export const dynamic = "force-dynamic";

export default async function DropSchemaPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const schema = decodeURIComponent(name);

  // Defense in depth: the list hides Delete for protected schemas, but this
  // page must refuse them too — never render a confirm ceremony for one.
  const reason = protectedReason(schema) ?? (await inUseReason(schema));
  if (reason) {
    return (
      <div className="space-y-4">
        <SchemaBanner schema={schema} />
        <h1 className="text-base font-semibold tracking-tight">Cannot drop schema</h1>
        <p className="max-w-prose text-sm text-foreground-muted">
          <span className="font-mono">{schema}</span> is {reason}. It is protected and cannot
          be dropped.
        </p>
      </div>
    );
  }

  const schemas = await listSchemaNames();
  if (!schemas.includes(schema)) notFound();

  return (
    <div className="space-y-4">
      <SchemaBanner schema={schema} />
      <h1 className="text-base font-semibold tracking-tight">
        Drop schema <span className="font-mono">{schema}</span>
      </h1>
      <DropSchemaConfirm schema={schema} />
    </div>
  );
}
