import { expect, test, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { sealData } from "iron-session";

const SESSION_SECRET = "x".repeat(32);
const OTHER_SECRET = "y".repeat(32);

beforeAll(() => {
  process.env.GOD_MODE_PASSWORD = "hunter2";
  process.env.SESSION_SECRET = SESSION_SECRET;
  process.env.DATABASE_URL = "postgresql://u:p@h:6432/postgres";
  process.env.SYSTEM_DATABASE_URL = "postgresql://u:p@h:6432/postgres";
});

async function run(path: string, cookieValue?: string) {
  const { middleware } = await import("../../middleware");
  const headers: Record<string, string> = {};
  if (cookieValue !== undefined) headers.cookie = `godmode_session=${cookieValue}`;
  return middleware(new NextRequest(`http://test${path}`, { headers }));
}

function expectRedirectToLogin(res: Response) {
  expect([307, 308]).toContain(res.status);
  expect(res.headers.get("location")?.endsWith("/login")).toBe(true);
}

function expectNotRedirect(res: Response) {
  expect(res.headers.get("location")).toBeNull();
  expect(res.status).toBe(200);
}

test("no cookie on / redirects to /login", async () => {
  expectRedirectToLogin(await run("/"));
});

test("no cookie on a destructive API route redirects to /login", async () => {
  expectRedirectToLogin(await run("/api/ops/drop-schema"));
});

test("no cookie on /login is not redirected", async () => {
  expectNotRedirect(await run("/login"));
});

test("garbage cookie redirects", async () => {
  expectRedirectToLogin(await run("/", "garbage"));
});

test("sealed authed:false redirects", async () => {
  const sealed = await sealData({ authed: false }, { password: SESSION_SECRET });
  expectRedirectToLogin(await run("/", sealed));
});

test("sealed authed:true passes", async () => {
  const sealed = await sealData({ authed: true }, { password: SESSION_SECRET });
  expectNotRedirect(await run("/", sealed));
});

test("cookie sealed with a different password (forged) redirects", async () => {
  const sealed = await sealData({ authed: true }, { password: OTHER_SECRET });
  expectRedirectToLogin(await run("/", sealed));
});
