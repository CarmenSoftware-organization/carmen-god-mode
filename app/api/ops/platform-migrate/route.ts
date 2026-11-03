import { requireAuth } from "@/lib/session";
import { readJsonObject, isOptionalString, isOptionalBoolean } from "@/lib/request-body";
import { env } from "@/lib/env";
import { streamOperation } from "@/lib/progress";
import { withTransaction } from "@/lib/db";
import { ensureAuditTable, writeAudit } from "@/lib/audit";
import { listBusinessUnits } from "@/lib/registry";
import { listSchemaNames } from "@/lib/introspect";
import { runProcess } from "@/lib/run-process";
import { ensureSchemaExists } from "@/lib/schema-bootstrap";
import {
  findOp, validateBuCode, validateOnlyPrefix, validateSchemaName, buildArgv, type CatalogOp,
} from "@/lib/platform-migrations";
import {
  assertPackageDir, assertPsql, buildSubprocessEnv, targetDbInfo, packageDir,
  listTenantFiles,
} from "@/lib/platform-package";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let running = false;

type Body = {
  opId: string; schema?: string; bu?: string; only?: string;
  confirm?: string; confirmDestroy?: boolean; confirmCreateSchema?: boolean;
};

const bad = (error: string, status: number) => Response.json({ error }, { status });

async function auditRun(
  op: CatalogOp,
  args: { bu?: string; only?: string },
  schema: string,
  code: number,
  actor: string,
): Promise<void> {
  await ensureAuditTable();
  await withTransaction(null, (tx) =>
    writeAudit(tx, {
      actor,
      schemaName: schema,
      tableName: null,
      operation: "MIGRATION",
      pk: null,
      oldValues: null,
      newValues: { opId: op.id, schema, bu: args.bu ?? null, only: args.only ?? null, exitCode: code },
      statement: `bun ${buildArgv(op, args).join(" ")}`,
    }),
  );
}

/** Audit the schema bootstrap as its own action, for both success and failure. */
async function auditSchemaCreate(schema: string, actor: string, ok: boolean): Promise<void> {
  await ensureAuditTable();
  await withTransaction(null, (tx) =>
    writeAudit(tx, {
      actor,
      schemaName: schema,
      tableName: null,
      operation: "CREATE_SCHEMA",
      pk: null,
      oldValues: null,
      newValues: { schema, ok },
      statement: `CREATE SCHEMA IF NOT EXISTS "${schema}"`,
    }),
  );
}

export async function POST(request: Request): Promise<Response> {
  let session: Awaited<ReturnType<typeof requireAuth>>;
  try {
    session = await requireAuth();
  } catch {
    return bad("Unauthorized", 401);
  }

  const body = await readJsonObject(request);
  if (!body) return bad("Request body must be a JSON object", 400);
  const { opId, schema, bu, only, confirm, confirmDestroy, confirmCreateSchema } = body as Body;
  if (typeof opId !== "string") return bad("opId must be a string", 400);
  if (
    !isOptionalString(schema) || !isOptionalString(bu) || !isOptionalString(only) ||
    !isOptionalString(confirm) || !isOptionalBoolean(confirmDestroy) || !isOptionalBoolean(confirmCreateSchema)
  ) {
    return bad("Invalid field types in request body", 400);
  }
  const op = findOp(opId);
  if (!op) return bad(`Unknown operation: ${opId}`, 404);
  if (op.group === "danger" && !env().allowDangerOps) {
    return bad("Danger operations are disabled; set ALLOW_DANGER_OPS=true to enable", 403);
  }

  // Validate the target schema (charset always; new-schema gate only for writes).
  const schemaName = (schema ?? "").trim();
  const schemaStatus = validateSchemaName(schemaName, await listSchemaNames());
  if (schemaStatus === "invalid") return bad(`Invalid schema name: ${schemaName}`, 400);

  // Validate optional args against allow-lists.
  if (bu) {
    if (!op.acceptsBu) return bad("This operation does not accept --bu", 400);
    const active = (await listBusinessUnits()).filter((b) => b.isActive).map((b) => b.code);
    if (!validateBuCode(bu, active)) return bad(`Unknown or invalid business unit: ${bu}`, 400);
  }
  if (only) {
    if (!op.acceptsOnly) return bad("This operation does not accept --only", 400);
    if (!validateOnlyPrefix(only, await listTenantFiles())) return bad(`No tenant migration matches: ${only}`, 400);
  }

  // Confirmation gates for write operations.
  if (op.writes && !op.readonly) {
    if ((confirm ?? "") !== schemaName) return bad(`Confirmation text must equal "${schemaName}"`, 400);
    if (op.destructive && confirmDestroy !== true) {
      return bad("Destructive operations require confirmDestroy: true", 400);
    }
    if (schemaStatus === "new" && confirmCreateSchema !== true) {
      return bad("Creating a new schema requires confirmCreateSchema: true", 400);
    }
  }

  // Preflight (clear errors before streaming begins).
  try {
    await assertPackageDir();
    if (op.requiresPsql) await assertPsql();
  } catch (e) {
    return bad(e instanceof Error ? e.message : String(e), 400);
  }

  const args = buildArgv(op, { bu, only });
  const cwd = packageDir();
  const spawnEnv = buildSubprocessEnv(schemaName);
  const masked = targetDbInfo(schemaName).masked;
  const actor = session.actor ?? "god";
  const bootstrap = op.writes && !op.readonly && schemaStatus === "new";

  if (running) return bad("A platform migration is already running", 409);
  running = true;

  return streamOperation(async (onProgress) => {
    try {
      if (bootstrap) {
        onProgress({ type: "log", line: `$ CREATE SCHEMA IF NOT EXISTS "${schemaName}"  (bootstrap)`, stream: "out" });
        let created = false;
        try {
          await ensureSchemaExists(schemaName);
          created = true;
        } finally {
          // Audit the bootstrap attempt itself (success or failure); never let an
          // audit error mask the original CREATE SCHEMA failure.
          try {
            await auditSchemaCreate(schemaName, actor, created);
          } catch (auditErr) {
            onProgress({ type: "log", line: `audit (CREATE_SCHEMA) failed: ${auditErr instanceof Error ? auditErr.message : String(auditErr)}`, stream: "err" });
          }
        }
      }
      onProgress({ type: "log", line: `$ bun ${args.join(" ")}  (cwd=${cwd}, target=${masked}, schema=${schemaName})`, stream: "out" });
      const { code } = await runProcess({
        command: "bun",
        args,
        cwd,
        env: spawnEnv,
        onLine: (line, stream) => onProgress({ type: "log", line, stream }),
      });
      await auditRun(op, { bu, only }, schemaName, code, actor);
      if (code !== 0) throw new Error(`${op.label} failed (exit code ${code})`);
      return { summary: `${op.label} completed (exit 0) on schema ${schemaName}` };
    } finally {
      running = false;
    }
  });
}
