import { expect, test } from "vitest";
import {
  CATALOG, findOp, visibleCatalog, validateBuCode, validateOnlyPrefix, buildArgv, canRun, validateSchemaName,
  extractTsFile, resolveScriptInfo,
} from "@/lib/platform-migrations";

test("catalog exposes the expected operation ids across groups", () => {
  const ids = CATALOG.map((o) => o.id);
  expect(ids).toEqual(expect.arrayContaining([
    "prisma-status", "prisma-deploy",
    "tenant-apply", "tenant-revert",
    "seed-currency-iso", "seed-permission", "seed-platform-super-admin",
    "seed-platform-role",
    "check-permission", "check-platform-permission", "check-platform-role-permission", "check-endpoint-permission",
    "check-api-system-permission",
    "migrate-reset",
  ]));
  expect(findOp("prisma-status")?.readonly).toBe(true);
  expect(findOp("prisma-deploy")?.writes).toBe(true);
  expect(findOp("migrate-reset")?.destructive).toBe(true);
});

test("drift-check ops are read-only (no confirm needed)", () => {
  const op = findOp("check-permission");
  expect(op?.group).toBe("check");
  expect(op?.readonly).toBe(true);
  expect(op?.writes).toBe(false);
  expect(op?.destructive).toBe(false);
  expect(op?.run).toBe("db:check.permission");
});

test("catalog does not offer ops whose scripts are absent from the package", () => {
  // These reference db:* scripts that don't exist in
  // @repo/prisma-shared-schema-backstage, so running them can only fail.
  expect(findOp("seed-application")).toBeUndefined();
  expect(findOp("mock-reset")).toBeUndefined();
  expect(findOp("seed")).toBeUndefined();
  expect(findOp("seed-reset")).toBeUndefined();
});

test("findOp returns undefined for unknown ids", () => {
  expect(findOp("nope")).toBeUndefined();
});

test("validateBuCode requires a known active code and a safe charset", () => {
  expect(validateBuCode("T03", ["T03", "T04"])).toBe(true);
  expect(validateBuCode("T99", ["T03"])).toBe(false);          // not active
  expect(validateBuCode("T03; DROP", ["T03; DROP"])).toBe(false); // bad charset
});

test("validateOnlyPrefix requires a matching existing file and a safe charset", () => {
  const files = ["001_v_operational_product_list.up.sql"];
  expect(validateOnlyPrefix("001_v_operational", files)).toBe(true);
  expect(validateOnlyPrefix("999_nope", files)).toBe(false);
  expect(validateOnlyPrefix("001 rm -rf", files)).toBe(false);
});

test("buildArgv builds bun argv for script and bin ops, with -- separated args", () => {
  expect(buildArgv(findOp("prisma-status")!, {})).toEqual(["x", "prisma", "migrate", "status"]);
  expect(buildArgv(findOp("prisma-deploy")!, {})).toEqual(["run", "db:deploy"]);
  expect(buildArgv(findOp("tenant-apply")!, { bu: "T03" }))
    .toEqual(["run", "db:tenant-views:apply", "--", "--bu", "T03"]);
  expect(buildArgv(findOp("tenant-apply")!, { only: "001_v" }))
    .toEqual(["run", "db:tenant-views:apply", "--", "--only", "001_v"]);
});

test("buildArgv ignores bu/only on ops that do not accept them", () => {
  expect(buildArgv(findOp("seed-permission")!, { bu: "T03", only: "x" })).toEqual(["run", "db:seed.permission"]);
});

test("every catalog op satisfies the gate invariants", () => {
  for (const op of CATALOG) {
    if (op.destructive) expect(op.writes).toBe(true);
    if (op.readonly) expect(op.writes).toBe(false);
  }
});

test("validateSchemaName classifies known / new / invalid names", () => {
  const existing = ["CARMEN_SYSTEM", "public"];
  expect(validateSchemaName("CARMEN_SYSTEM", existing)).toBe("known");
  expect(validateSchemaName("NEW_ENV", existing)).toBe("new");
  expect(validateSchemaName("bad;name", existing)).toBe("invalid");
  expect(validateSchemaName("1leading", existing)).toBe("invalid");
  expect(validateSchemaName("", existing)).toBe("invalid");
});

test("canRun gates writes on the schema phrase, destructive checkbox, and new-schema checkbox", () => {
  const status = findOp("prisma-status")!;
  const deploy = findOp("prisma-deploy")!;
  const reset = findOp("migrate-reset")!;
  const known = ["CARMEN_SYSTEM"];
  const base = { schema: "CARMEN_SYSTEM", knownSchemas: known, destroyChecked: false, createChecked: false };

  // read-only: runs as long as the schema is a valid name
  expect(canRun(status, { ...base, confirm: "" })).toBe(true);
  expect(canRun(status, { ...base, schema: "bad;name", confirm: "" })).toBe(false);

  // write: confirm must equal the schema
  expect(canRun(deploy, { ...base, confirm: "wrong" })).toBe(false);
  expect(canRun(deploy, { ...base, confirm: "CARMEN_SYSTEM" })).toBe(true);

  // destructive: also needs the destroy checkbox
  expect(canRun(reset, { ...base, confirm: "CARMEN_SYSTEM" })).toBe(false);
  expect(canRun(reset, { ...base, confirm: "CARMEN_SYSTEM", destroyChecked: true })).toBe(true);

  // new schema on a write: needs the create checkbox
  expect(canRun(deploy, { ...base, schema: "NEW_ENV", confirm: "NEW_ENV" })).toBe(false);
  expect(canRun(deploy, { ...base, schema: "NEW_ENV", confirm: "NEW_ENV", createChecked: true })).toBe(true);
});

test("extractTsFile returns the basename of a single .ts in the command", () => {
  expect(extractTsFile("ts-node -r tsconfig-paths/register prisma/seed.permission.ts"))
    .toBe("seed.permission.ts");
});

test("extractTsFile returns null when there is no .ts", () => {
  expect(extractTsFile("prisma migrate deploy")).toBeNull();
});

test("extractTsFile picks the single .ts from a compound command", () => {
  expect(extractTsFile(
    "prisma migrate reset --force && ts-node -r tsconfig-paths/register prisma/seed.ts",
  )).toBe("seed.ts");
});

test("extractTsFile returns null when multiple distinct .ts files are present", () => {
  expect(extractTsFile("ts-node a.ts && ts-node b.ts")).toBeNull();
});

test("resolveScriptInfo returns the run command for bin ops without a file", () => {
  const info = resolveScriptInfo(findOp("prisma-status")!, { "db:seed": "ts-node prisma/seed.ts" });
  expect(info).toEqual({ script: "prisma migrate status", file: null, missing: false });
});

test("resolveScriptInfo resolves a known script to its .ts file", () => {
  const info = resolveScriptInfo(findOp("seed-permission")!, {
    "db:seed.permission": "ts-node -r tsconfig-paths/register prisma/seed.permission.ts",
  });
  expect(info).toEqual({ script: "db:seed.permission", file: "seed.permission.ts", missing: false });
});

test("resolveScriptInfo flags a script missing from the package", () => {
  const info = resolveScriptInfo(findOp("seed-permission")!, { "db:seed": "ts-node prisma/seed.ts" });
  expect(info).toEqual({ script: "db:seed.permission", file: null, missing: true });
});

test("resolveScriptInfo does not accuse when scripts are unavailable", () => {
  const info = resolveScriptInfo(findOp("seed-permission")!, null);
  expect(info).toEqual({ script: "db:seed.permission", file: null, missing: false });
});

test("visibleCatalog hides the danger group unless allowed", () => {
  expect(visibleCatalog(false).some((o) => o.group === "danger")).toBe(false);
  expect(visibleCatalog(false).map((o) => o.id)).not.toContain("migrate-reset");
  expect(visibleCatalog(true).map((o) => o.id)).toContain("migrate-reset");
  expect(visibleCatalog(true)).toHaveLength(CATALOG.length);
});
