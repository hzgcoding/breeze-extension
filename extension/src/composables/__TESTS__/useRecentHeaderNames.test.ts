import { describe, expect, it } from "vitest";
import { addNameToRecentHeaderNames } from "../useRecentHeaderNames";

describe("addNameToRecentHeaderNames", () => {
  it.each(["bad name", "x-test: value", " x-test", "x-test\r\ninjected", "头部"])("rejects invalid header name %j", (name) => {
    expect(addNameToRecentHeaderNames(["accept"], name)).toEqual(["accept"]);
  });

  it("removes malformed stored names when adding a valid name", () => {
    expect(addNameToRecentHeaderNames(["bad name", "Content-Type", "x:bad"], "Authorization"))
      .toEqual(["authorization", "content-type"]);
  });

  it("keeps valid recent names unique and within the history limit", () => {
    expect(addNameToRecentHeaderNames(["accept", "x-test", "cookie"], "Authorization"))
      .toEqual(["authorization", "accept", "x-test"]);
    expect(addNameToRecentHeaderNames(["accept", "x-test"], "Accept"))
      .toEqual(["accept", "x-test"]);
  });
});
