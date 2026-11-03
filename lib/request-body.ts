/**
 * Parse a request body as a plain JSON object.
 * Returns null if the body isn't valid JSON or isn't a non-array, non-null object.
 */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

export const isOptionalString = (v: unknown): v is string | undefined =>
  v === undefined || typeof v === "string";

export const isOptionalBoolean = (v: unknown): v is boolean | undefined =>
  v === undefined || typeof v === "boolean";

export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
