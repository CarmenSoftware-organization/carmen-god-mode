import { describeTable } from "@/lib/introspect";
import { coerceValue } from "@/lib/coerce";

// Deliberately NOT in a "use server" file: every exported async function there is
// a publicly callable server action, and this helper does no auth check.
export async function valuesFromForm(
  schema: string,
  table: string,
  formData: FormData,
  includeAllColumns: boolean,
): Promise<Record<string, unknown>> {
  const shape = await describeTable(schema, table);
  const values: Record<string, unknown> = {};
  for (const col of shape.columns) {
    const present = formData.has(`f_${col.name}`);
    if (!includeAllColumns && !present && !formData.has(`null_${col.name}`)) continue;
    const isNull = formData.get(`null_${col.name}`) === "on";
    const raw = String(formData.get(`f_${col.name}`) ?? "");
    if (col.isPrimaryKey && col.default && raw.trim() === "" && !isNull) continue; // let DB default fire
    values[col.name] = coerceValue(col, raw, isNull);
  }
  return values;
}

/** Parse a primary-key JSON blob: a non-empty object of scalar values only. */
export function parsePk(pkJson: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(pkJson);
  } catch {
    throw new Error("Invalid primary key");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Invalid primary key");
  }
  const entries = Object.values(parsed as Record<string, unknown>);
  if (entries.length === 0 || !entries.every((v) => ["string", "number", "boolean"].includes(typeof v))) {
    throw new Error("Invalid primary key");
  }
  return parsed as Record<string, unknown>;
}
