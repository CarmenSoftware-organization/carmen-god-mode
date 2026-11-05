"use server";
import { env } from "@/lib/env";
import { requireAuth } from "@/lib/session";
import { computeBlastRadiusMany, type BlastRadius } from "@/lib/cascade";
import { requiredPhrase, radiusTouchesBusinessUnits } from "@/lib/delete-confirm";
import { isPlainObject } from "@/lib/request-body";

export type BatchDeletePreview = {
  radius: BlastRadius;
  orphanWarning: boolean;
  requiredPhrase: string;
};

/** Read-only blast-radius preview for the delete-batch page. pks travel in the POST body, not the URL. */
export async function previewBatchDelete(schema: unknown, table: unknown, pks: unknown): Promise<BatchDeletePreview> {
  await requireAuth();
  if (typeof schema !== "string" || typeof table !== "string") throw new Error("Invalid target table");
  if (!Array.isArray(pks) || pks.length === 0 || !pks.every(isPlainObject)) throw new Error("No rows selected");
  const radius = await computeBlastRadiusMany(schema, table, pks);
  return {
    radius,
    orphanWarning: radiusTouchesBusinessUnits(radius.byTable, env().systemSchemaName),
    requiredPhrase: requiredPhrase({ isBusinessUnit: false, dropSchema: null }),
  };
}
