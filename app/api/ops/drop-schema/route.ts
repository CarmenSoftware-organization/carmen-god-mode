import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/session";
import { readJsonObject, isOptionalString } from "@/lib/request-body";
import { executeDropSchema, isProtectedSchema } from "@/lib/drop-schema";
import { streamOperation } from "@/lib/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { schema: string; confirm: string };

export async function POST(request: Request): Promise<Response> {
  try {
    await requireAuth();
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Request body must be a JSON object" }, { status: 400 });
  const { schema, confirm } = body as Body;
  if (typeof schema !== "string" || schema.length === 0) {
    return Response.json({ error: "No schema specified" }, { status: 400 });
  }
  if (!isOptionalString(confirm)) {
    return Response.json({ error: "confirm must be a string" }, { status: 400 });
  }
  if (isProtectedSchema(schema)) {
    return Response.json(
      { error: `Refusing to drop the protected schema "${schema}".` },
      { status: 400 },
    );
  }
  // The confirm phrase for a schema drop is the schema name itself (mirrors the
  // business-unit drop flow in lib/delete-confirm).
  if (confirm !== schema) {
    return Response.json(
      { error: `Confirmation text must equal "${schema}"` },
      { status: 400 },
    );
  }

  return streamOperation(async (onProgress) => {
    const res = await executeDropSchema(schema, { onProgress });
    try {
      revalidatePath("/schemas");
    } catch {
      /* revalidation is best-effort; the drop already committed */
    }
    return { summary: `Dropped schema ${res.droppedSchema}`, redirect: "/schemas" };
  });
}
