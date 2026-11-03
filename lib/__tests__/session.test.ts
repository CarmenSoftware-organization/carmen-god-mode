import { expect, test, beforeAll, vi } from "vitest";
beforeAll(() => {
  process.env.GOD_MODE_PASSWORD = "hunter2";
  process.env.SESSION_SECRET = "x".repeat(32);
  process.env.DATABASE_URL = "postgresql://u:p@h:6432/postgres";
  process.env.SYSTEM_DATABASE_URL = "postgresql://u:p@h:6432/postgres";
});

test("verifyPassword is correct and length-safe", async () => {
  const { verifyPassword } = await import("@/lib/session");
  expect(verifyPassword("hunter2")).toBe(true);
  expect(verifyPassword("wrong")).toBe(false);
  expect(verifyPassword("")).toBe(false);
});

test("assertAuthed throws when authed is false", async () => {
  const { assertAuthed } = await import("@/lib/session");
  expect(() => assertAuthed({ authed: false })).toThrow(/unauthorized/i);
});

test("assertAuthed does not throw when authed is true", async () => {
  const { assertAuthed } = await import("@/lib/session");
  expect(() => assertAuthed({ authed: true })).not.toThrow();
});

test("assertAuthed accepts a session carrying a method", async () => {
  const { assertAuthed } = await import("@/lib/session");
  expect(() => assertAuthed({ authed: true, actor: "alice", method: "gateway" })).not.toThrow();
});

test("session cookie is httpOnly and sameSite lax", async () => {
  const { sessionOptions } = await import("@/lib/session");
  expect(sessionOptions.cookieOptions?.httpOnly).toBe(true);
  expect(sessionOptions.cookieOptions?.sameSite).toBe("lax");
});

test("session cookie is secure in production", async () => {
  const prev = process.env.NODE_ENV;
  vi.stubEnv("NODE_ENV", "production");
  try {
    vi.resetModules();
    const { sessionOptions } = await import("@/lib/session");
    expect(sessionOptions.cookieOptions?.secure).toBe(true);
  } finally {
    vi.unstubAllEnvs();
    if (process.env.NODE_ENV !== prev) vi.stubEnv("NODE_ENV", prev ?? "test");
    vi.resetModules();
  }
});

test("verifyPassword rejects near-miss passwords", async () => {
  const { verifyPassword } = await import("@/lib/session");
  for (const bad of ["hunter", "hunter22", "Hunter2", "hunter2 "]) {
    expect(verifyPassword(bad)).toBe(false);
  }
});
