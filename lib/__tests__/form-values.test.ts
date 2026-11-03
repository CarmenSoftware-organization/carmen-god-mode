import { describe, expect, test } from "vitest";
import { parsePk } from "@/lib/form-values";

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
