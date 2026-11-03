import { describe, expect, test } from "vitest";
import { parsePk, assertPkMatchesTable } from "@/lib/form-values";

describe("parsePk", () => {
  test("accepts scalar-valued objects", () => {
    expect(parsePk('{"id":1}')).toEqual({ id: 1 });
    expect(parsePk('{"a":"x","b":2}')).toEqual({ a: "x", b: 2 });
    expect(parsePk('{"a":true}')).toEqual({ a: true });
  });

  test.each(["not json", "{}", "[]", "null", '"1"', '{"id":null}', '{"id":{"$ne":1}}', '{"id":[1]}'])(
    "rejects %s",
    (input) => {
      expect(() => parsePk(input)).toThrow("Invalid primary key");
    },
  );
});

describe("assertPkMatchesTable", () => {
  test("accepts exact match regardless of order", () => {
    expect(() => assertPkMatchesTable({ id: 1 }, ["id"])).not.toThrow();
    expect(() => assertPkMatchesTable({ b: 1, a: 2 }, ["a", "b"])).not.toThrow();
  });
  test.each([
    ["subset", { a: 1 }, ["a", "b"]],
    ["superset", { a: 1, b: 2 }, ["a"]],
    ["different key", { status: "active" }, ["id"]],
    ["empty primaryKey", { id: 1 }, []],
  ] as [string, Record<string, unknown>, string[]][])("rejects %s", (_n, pk, primaryKey) => {
    expect(() => assertPkMatchesTable(pk, primaryKey)).toThrow("Invalid primary key");
  });
});
