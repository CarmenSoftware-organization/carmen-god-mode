import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// Every exported async function in a "use server" file is a publicly callable
// endpoint. This guard makes sure each one authenticates before doing anything.

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib", "server"];
const SKIP_DIRS = new Set(["node_modules", ".next", "__tests__"]);

/** Actions that legitimately run without an existing session, with the reason. */
const ALLOWLIST: Record<string, string> = {
  "server/auth.ts#login": "establishes the session (shared-secret login)",
  "server/auth.ts#gatewayLogin": "establishes the session (gateway login)",
  "server/auth.ts#logout": "destroys the session; harmless when unauthenticated",
};

const FIRST_STATEMENT = /^\s*(const\s+\w+\s*=\s*|\w+\s*=\s*)?await\s+requireAuth\(\)/;

/** Blank out comments, preserving string literals and length-agnostic layout. */
export function stripComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === "/" && n === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "/" && n === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
    } else if (c === '"' || c === "'" || c === "`") {
      const q = c;
      out += c;
      i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === "\\") {
          out += src[i++];
        }
        out += src[i++] ?? "";
      }
      out += q;
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Index just past the `)` matching the `(` at `open`. */
function matchParen(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")" && --depth === 0) return i + 1;
  }
  return -1;
}

/** Index of the `{` opening the function body, skipping any return-type annotation. */
function findBodyBrace(s: string, from: number): number {
  let angle = 0;
  let prev = "";
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (/\s/.test(c)) continue;
    if (c === "<") angle++;
    else if (c === ">" && s[i - 1] !== "=") angle--;
    else if (c === "{" && angle === 0 && (prev === "" || !":|&,<(=".includes(prev))) return i;
    else if (c === "{") {
      // Object type literal in the return annotation: skip it whole.
      let d = 0;
      for (; i < s.length; i++) {
        if (s[i] === "{") d++;
        else if (s[i] === "}" && --d === 0) break;
      }
      prev = "}";
      continue;
    }
    prev = c;
  }
  return -1;
}

/** Violations found in one source file (empty when it is not a server-action module). */
export function findViolations(file: string, raw: string): string[] {
  const src = stripComments(raw);
  if (!/^\s*(["'])use server\1/.test(src)) return [];
  const problems: string[] = [];

  if (/\bexport\s+(const|let|var)\s+\w+[^=\n]*=\s*(async\b|\()/.test(src)) {
    problems.push(`${file}: 'export const|let = …' is not allowed in a "use server" file; use 'export async function'`);
  }
  if (/\bexport\s+default\b/.test(src)) {
    problems.push(`${file}: 'export default' is not allowed in a "use server" file`);
  }
  if (/\bexport\s*(type\s*)?\{/.test(src) && /\bexport\s*\{/.test(src)) {
    problems.push(`${file}: 'export { … }' is not allowed in a "use server" file`);
  }

  const re = /\bexport\s+async\s+function\s+(\w+)\s*(<[^(]*>)?\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const name = m[1];
    if (ALLOWLIST[`${file}#${name}`]) continue;
    const paramsEnd = matchParen(src, m.index + m[0].length - 1);
    const brace = paramsEnd < 0 ? -1 : findBodyBrace(src, paramsEnd);
    if (brace < 0) {
      problems.push(`${file}#${name}: could not locate function body`);
      continue;
    }
    if (!FIRST_STATEMENT.test(src.slice(brace + 1))) {
      problems.push(`${file}#${name}: first statement must be 'await requireAuth()'`);
    }
  }
  return problems;
}

function walk(dir: string, out: string[]): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name)) out.push(p);
  }
}

const files: string[] = [];
for (const d of SCAN_DIRS) {
  const abs = path.join(ROOT, d);
  if (fs.existsSync(abs)) walk(abs, files);
}
const sources = files.map((f) => ({
  rel: path.relative(ROOT, f).split(path.sep).join("/"),
  text: fs.readFileSync(f, "utf8"),
}));

describe("server actions must authenticate first", () => {
  test("scan finds the known server-action modules (not vacuous)", () => {
    const mods = sources.filter((s) => /^\s*(["'])use server\1/.test(stripComments(s.text))).map((s) => s.rel);
    expect(mods).toEqual(
      expect.arrayContaining(["server/auth.ts", "server/sql.ts", "server/rows.ts", "server/cluster-actions.ts"]),
    );
  });

  test("every exported async function in a 'use server' file calls requireAuth() first", () => {
    const problems = sources.flatMap((s) => findViolations(s.rel, s.text));
    expect(problems).toEqual([]);
  });

  test("no inline 'use server' directives inside functions", () => {
    const inline = sources
      .filter((s) => /^\s*(["'])use server\1/.test(stripComments(s.text)) === false)
      .filter((s) => /^\s*["']use server["']\s*;?\s*$/m.test(stripComments(s.text)))
      .map((s) => s.rel);
    expect(inline).toEqual([]);
  });

  test("allowlist entries still exist (no stale exemptions)", () => {
    for (const key of Object.keys(ALLOWLIST)) {
      const [file, name] = key.split("#");
      const src = sources.find((s) => s.rel === file);
      expect(src, `${file} missing`).toBeDefined();
      expect(src!.text).toMatch(new RegExp(`export\\s+async\\s+function\\s+${name}\\b`));
    }
  });

  describe("scanner self-check", () => {
    const ok = `"use server";\nexport async function a(x: { y: number }): Promise<{ z: number }> {\n  const s = await requireAuth();\n  return { z: 1 };\n}\n`;
    test("accepts guarded actions (incl. object types and assignment)", () => {
      expect(findViolations("f.ts", ok)).toEqual([]);
    });
    test("commented-out requireAuth is a violation", () => {
      const bad = `"use server";\nexport async function a() {\n  // await requireAuth();\n  return 1;\n}\n`;
      expect(findViolations("f.ts", bad)).toHaveLength(1);
      const bad2 = `"use server";\nexport async function a() {\n  /* await requireAuth(); */\n  return 1;\n}\n`;
      expect(findViolations("f.ts", bad2)).toHaveLength(1);
    });
    test("requireAuth not first is a violation", () => {
      const bad = `"use server";\nexport async function a() {\n  doThing();\n  await requireAuth();\n}\n`;
      expect(findViolations("f.ts", bad)).toHaveLength(1);
    });
    test("export const / default / export {} are violations", () => {
      expect(findViolations("f.ts", `"use server";\nexport const a = async () => { await requireAuth(); };\n`)).not.toEqual([]);
      expect(findViolations("f.ts", `"use server";\nexport default async function () {}\n`)).not.toEqual([]);
      expect(findViolations("f.ts", `"use server";\nasync function a() {}\nexport { a };\n`)).not.toEqual([]);
    });
    test("function with no return type annotation is checked", () => {
      expect(findViolations("f.ts", `"use server";\nexport async function a() {}\n`)).toEqual([
        "f.ts#a: first statement must be 'await requireAuth()'",
      ]);
    });
    test("non-server-action files are ignored", () => {
      expect(findViolations("f.ts", `export async function a() {}\n`)).toEqual([]);
    });
  });
});
