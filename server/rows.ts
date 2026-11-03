"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { valuesFromForm, parsePk, assertPkMatchesTable } from "@/lib/form-values";
import { applyInsert, applyUpdate } from "@/lib/write";
import { describeTable } from "@/lib/introspect";
import { requireAuth } from "@/lib/session";

export async function submitInsert(schema: string, table: string, formData: FormData): Promise<void> {
  await requireAuth();
  const values = await valuesFromForm(schema, table, formData, false);
  await applyInsert(schema, table, values);
  revalidatePath(`/${schema}/${table}`);
  redirect(`/${encodeURIComponent(schema)}/${encodeURIComponent(table)}`);
}

export async function submitUpdate(schema: string, table: string, pkJson: string, formData: FormData): Promise<void> {
  await requireAuth();
  const pk = parsePk(pkJson);
  assertPkMatchesTable(pk, (await describeTable(schema, table)).primaryKey);
  const values = await valuesFromForm(schema, table, formData, true);
  for (const k of Object.keys(pk)) delete values[k]; // never update pk columns
  await applyUpdate(schema, table, pk, values);
  revalidatePath(`/${schema}/${table}`);
  redirect(`/${encodeURIComponent(schema)}/${encodeURIComponent(table)}`);
}
