export function ident(name: string): string {
  if (typeof name !== "string" || name.length === 0) throw new Error("Invalid identifier: empty");
  if (Buffer.byteLength(name, "utf8") > 63) throw new Error(`Invalid identifier: too long (${name})`);
  if (name.includes("\0")) throw new Error("Invalid identifier: NUL byte");
  return '"' + name.replace(/"/g, '""') + '"';
}

export function qualified(schema: string, table: string): string {
  return `${ident(schema)}.${ident(table)}`;
}

function stripLeading(sqlText: string): string {
  let s = sqlText.trim();
  // strip leading line and block comments repeatedly
  while (true) {
    if (s.startsWith("--")) { const nl = s.indexOf("\n"); s = nl === -1 ? "" : s.slice(nl + 1).trimStart(); continue; }
    if (s.startsWith("/*")) { const end = s.indexOf("*/"); s = end === -1 ? "" : s.slice(end + 2).trimStart(); continue; }
    break;
  }
  return s;
}

export function classifyStatement(sqlText: string): "read" | "write" {
  const s = stripLeading(sqlText).toUpperCase();
  if (/^EXPLAIN\s+ANALYZE/.test(s)) return "write";
  if (/^(SELECT|EXPLAIN|SHOW|TABLE|VALUES)\b/.test(s)) return "read";
  if (/^WITH\b/.test(s)) {
    // A CTE chain is a write iff it contains a data-modifying statement.
    return /\b(INSERT|UPDATE|DELETE|MERGE)\b/.test(s) ? "write" : "read";
  }
  return "write";
}

export class ConsoleSqlRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsoleSqlRejected";
  }
}

const CONSOLE_READ_KEYWORDS = new Set(["SELECT", "WITH", "TABLE", "VALUES", "EXPLAIN", "SHOW", "("]);
const CONSOLE_WRITE_KEYWORDS = new Set([
  "INSERT", "UPDATE", "DELETE", "MERGE", "CREATE", "ALTER", "DROP", "TRUNCATE", "GRANT", "REVOKE", "COMMENT",
]);
const CONSOLE_DENY_FN =
  /\b(pg_terminate_backend|pg_cancel_backend|pg_reload_conf|pg_rotate_logfile|pg_promote|pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_import|lo_export|lo_unlink|dblink\w*|set_config|pg_advisory_\w*lock\w*|pg_sleep\w*)\s*\(/;

/**
 * Vets a SQL-console statement before it runs: allowlisted leading keyword and
 * no side-effect function calls. A mistake guard, not a sandbox — a determined
 * admin can still bypass it. See
 * docs/superpowers/specs/2026-11-03-security-test-suite-design.md.
 */
export function checkConsoleStatement(sqlText: string): "read" | "write" {
  const s = stripLeading(sqlText).toUpperCase();
  if (s.length === 0) throw new ConsoleSqlRejected("Empty statement");
  const keyword = s.startsWith("(") ? "(" : (/^[A-Z]+/.exec(s)?.[0] ?? "");
  if (!CONSOLE_READ_KEYWORDS.has(keyword) && !CONSOLE_WRITE_KEYWORDS.has(keyword)) {
    throw new ConsoleSqlRejected(`Statement type not allowed in console: ${keyword || s.slice(0, 20)}`);
  }
  const fn = CONSOLE_DENY_FN.exec(sqlText.toLowerCase().replace(/"/g, ""));
  if (fn) throw new ConsoleSqlRejected(`Function not allowed in console: ${fn[1]}`);
  // classifyStatement treats a leading "(" as write; a parenthesised top-level statement is a query.
  if (keyword === "(") return "read";
  return classifyStatement(sqlText);
}
