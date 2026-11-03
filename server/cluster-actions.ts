"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import { requireAuth } from "@/lib/session";
import { softDeleteRows, restoreRows } from "@/lib/soft-delete";
import { valuesFromForm, parsePk } from "@/lib/form-values";
import { applyInsert, applyUpdate } from "@/lib/write";

const TABLE = "tb_cluster";

function parsePks(formData: FormData): Record<string, unknown>[] {
  const pks = JSON.parse(String(formData.get("pks") ?? "[]"));
  if (!Array.isArray(pks) || pks.length === 0) throw new Error("No rows selected");
  return pks as Record<string, unknown>[];
}

// tb_cluster carries the app's deleted_by_id audit column. God mode has no real
// user UUID, so we stamp the optional GOD_MODE_USER_ID when configured (NULL otherwise).
function softDeleteOpts() {
  return { deletedByColumn: "deleted_by_id", deletedById: env().godModeUserId ?? null };
}

export async function softDeleteClusters(formData: FormData): Promise<void> {
  await requireAuth();
  await softDeleteRows(env().systemSchemaName, TABLE, parsePks(formData), softDeleteOpts());
  revalidatePath("/clusters");
}

export async function restoreClusters(formData: FormData): Promise<void> {
  await requireAuth();
  await restoreRows(env().systemSchemaName, TABLE, parsePks(formData), softDeleteOpts());
  revalidatePath("/clusters");
}

export async function submitClusterInsert(formData: FormData): Promise<void> {
  await requireAuth();
  const schema = env().systemSchemaName;
  const values = await valuesFromForm(schema, TABLE, formData, false);
  await applyInsert(schema, TABLE, values);
  revalidatePath("/clusters");
  redirect("/clusters");
}

export async function submitClusterUpdate(pkJson: string, formData: FormData): Promise<void> {
  await requireAuth();
  const schema = env().systemSchemaName;
  const pk = parsePk(pkJson);
  // includeAllColumns=false: the cluster edit form hides deleted_at, so we must NOT
  // touch columns absent from the form (true would clobber deleted_at to "").
  const values = await valuesFromForm(schema, TABLE, formData, false);
  for (const k of Object.keys(pk)) delete values[k];
  await applyUpdate(schema, TABLE, pk, values);
  revalidatePath("/clusters");
  redirect("/clusters");
}
