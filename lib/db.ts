import postgres, { type Sql, type TransactionSql } from "postgres";
import { env } from "@/lib/env";
import { ident, qualified } from "@/lib/sql-guard";

let sql: Sql | null = null;
export function getSql(): Sql {
  if (!sql) sql = postgres(env().databaseUrl, { prepare: false, max: 10, onnotice: () => {} });
  return sql;
}

export async function withTransaction<T>(
  schema: string | null,
  fn: (tx: TransactionSql) => Promise<T>,
  opts?: { readOnly?: boolean },
): Promise<T> {
  const run = async (tx: TransactionSql) => {
    if (schema) await tx.unsafe(`SET LOCAL search_path TO ${ident(schema)}`);
    return fn(tx);
  };
  if (opts?.readOnly) {
    return getSql().begin("read only", (tx) => run(tx as TransactionSql)) as Promise<T>;
  }
  return getSql().begin((tx) => run(tx as TransactionSql)) as Promise<T>;
}

export { ident, qualified };
