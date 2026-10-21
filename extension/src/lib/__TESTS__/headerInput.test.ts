import { describe, expect, it } from "vitest";
import { isValidHeaderName, isValidHeaderValue, parseHeaderLines } from "../headerInput";

describe("header input validation", () => {
  it("accepts HTTP token names without changing their case", () => {
    expect(isValidHeaderName("Content-Type")).toBe(true);
    expect(isValidHeaderName("X-!#$%&'*+-.^_`|~09")).toBe(true);
  });

  it.each(["", "bad name", " x-test", "x-test ", "x:test", ":authority", "x\rtest", "x\ntest", "请求头"])("rejects invalid name %j", (name) => {
    expect(isValidHeaderName(name)).toBe(false);
  });

  it("accepts empty values and preserves ordinary punctuation and whitespace", () => {
    expect(isValidHeaderValue("")).toBe(true);
    expect(isValidHeaderValue(" Bearer token:part\t ")).toBe(true);
  });

  it.each(["one\rtwo", "one\ntwo", "one\r\ntwo"])("rejects line breaks in values %j", (value) => {
    expect(isValidHeaderValue(value)).toBe(false);
  });
});

describe("parseHeaderLines", () => {
  it("splits at the first colon and accepts LF and CRLF header lists", () => {
    expect(parseHeaderLines("Authorization: Bearer token:part\r\nLocation: https://localhost:3000/path\nX-Empty:"))
      .toEqual({
        headers: [
          { name: "Authorization", value: "Bearer token:part", line: 1 },
          { name: "Location", value: "https://localhost:3000/path", line: 2 },
          { name: "X-Empty", value: "", line: 3 },
        ],
        errors: [],
      });
  });

  it("ignores blank lines and strips only optional whitespace around values", () => {
    expect(parseHeaderLines("\n \t\nX-Test:\t value : part \t\n"))
      .toEqual({ headers: [{ name: "X-Test", value: "value : part", line: 3 }], errors: [] });
    expect(parseHeaderLines(" \t\n")).toEqual({ headers: [], errors: [] });
  });

  it("reports every malformed line while retaining valid rows for preview", () => {
    expect(parseHeaderLines("Accept: application/json\nmissing-colon\nbad name: value\nX-Test : value\nX-Test: one\rtwo\n: empty"))
      .toEqual({
        headers: [{ name: "Accept", value: "application/json", line: 1 }],
        errors: [
          { line: 2, reason: "missingColon" },
          { line: 3, reason: "invalidName" },
          { line: 4, reason: "invalidName" },
          { line: 5, reason: "invalidValue" },
          { line: 6, reason: "invalidName" },
        ],
      });
  });

  it("rejects folded values and does not treat HTTP pseudo headers as normal headers", () => {
    expect(parseHeaderLines("X-Test: value\n continuation\n:method: GET"))
      .toEqual({
        headers: [{ name: "X-Test", value: "value", line: 1 }],
        errors: [
          { line: 2, reason: "missingColon" },
          { line: 3, reason: "invalidName" },
        ],
      });
  });
});
