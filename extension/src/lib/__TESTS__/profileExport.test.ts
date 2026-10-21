import { describe, expect, it } from "vitest";
import { sanitizeProfileExport, serializeProfileExport } from "../profileExport";

function exchange() {
  return {
    version: 2,
    profiles: [{
      ref: "profile-1",
      groupRef: "group-1",
      name: "Private name",
      comments: "Custom secrets require review",
      emoji: "P",
      enabled: false,
      ruleActionType: "modifyHeaders",
      filters: {},
      requestHeaderModGroups: [{
        type: "checkbox",
        items: [
          { enabled: true, name: "aUtHoRiZaTiOn", operation: "set", value: "Bearer private" },
          { enabled: false, name: "X-Api-Key", operation: "append", value: "disabled-key" },
          { enabled: true, name: "x-environment", operation: "set", value: "staging" },
          { enabled: true, name: "Cookie", operation: "remove" },
        ],
      }],
      responseHeaderModGroups: [{
        type: "checkbox",
        items: [{ enabled: true, name: "Set-Cookie", operation: "append", value: "session=private" }],
      }],
      syncCookieGroups: [{
        type: "checkbox",
        items: [{ enabled: false, domain: "example.com", name: "session", path: "/", value: "live-cookie" }],
      }],
    }],
    profileGroups: [{ ref: "group-1", name: "Environments", type: "radio", color: "blue", lastEnabledProfileRefs: ["profile-1"] }],
  };
}

describe("profile export privacy", () => {
  it("clears recognized sensitive request and response values without mutating the source", () => {
    const input = exchange();
    const before = structuredClone(input);
    const result = sanitizeProfileExport(input);
    const profile = result.exchange.profiles[0]!;
    expect(profile.requestHeaderModGroups?.[0]?.items).toEqual([
      { enabled: true, name: "aUtHoRiZaTiOn", operation: "set", value: "" },
      { enabled: false, name: "X-Api-Key", operation: "append", value: "" },
      { enabled: true, name: "x-environment", operation: "set", value: "staging" },
      { enabled: true, name: "Cookie", operation: "remove" },
    ]);
    expect(profile.responseHeaderModGroups?.[0]?.items[0]).toMatchObject({ value: "" });
    expect(profile.syncCookieGroups?.[0]?.items[0]).toMatchObject({ value: "", domain: "example.com", path: "/", name: "session" });
    expect(result.sensitiveHeaderCount).toBe(3);
    expect(result.sensitiveHeaderNames).toEqual(["authorization", "set-cookie", "x-api-key"]);
    expect(input).toEqual(before);
    expect(result.exchange).toMatchObject({
      profiles: [{ ref: "profile-1", groupRef: "group-1", name: "Private name", comments: "Custom secrets require review" }],
      profileGroups: [{ ref: "group-1", lastEnabledProfileRefs: ["profile-1"] }],
    });
  });

  it.each([
    "Proxy-Authorization",
    "Cookie",
    "Set-Cookie",
    "X-Auth-Token",
    "Access-Token",
    "X-Access-Token",
    "X-Client-Secret",
    "X-Session-Token",
    "api_key",
    "client_secret",
    "X-CSRFToken",
    "X-ClientSecret",
  ])("recognizes %s case insensitively", (name) => {
    const input = exchange();
    input.profiles[0]!.requestHeaderModGroups[0]!.items = [{ enabled: true, name: name.toUpperCase(), operation: "set", value: "secret" }];
    expect(sanitizeProfileExport(input).exchange.profiles[0]?.requestHeaderModGroups?.[0]?.items[0]).toMatchObject({ value: "" });
  });

  it("retains explicitly included Header values while always clearing synced cookies", () => {
    const result = sanitizeProfileExport(exchange(), true);
    expect(result.exchange.profiles[0]?.requestHeaderModGroups?.[0]?.items[0]).toMatchObject({ value: "Bearer private" });
    expect(result.exchange.profiles[0]?.responseHeaderModGroups?.[0]?.items[0]).toMatchObject({ value: "session=private" });
    expect(result.exchange.profiles[0]?.syncCookieGroups?.[0]?.items[0]?.value).toBe("");
  });

  it("validates edited exchange JSON and sanitizes legacy imports too", () => {
    const input = exchange();
    const result = sanitizeProfileExport({ version: 1, profiles: input.profiles });
    expect(result.exchange.version).toBe(1);
    expect(JSON.stringify(result.exchange)).not.toContain("Bearer private");
    expect(() => sanitizeProfileExport({ version: 2, profiles: [] })).toThrow();
  });

  it("leaves regular token-related metadata headers intact and reports only nonempty sensitive values", () => {
    const input = exchange();
    input.profiles[0]!.requestHeaderModGroups[0]!.items = [
      { enabled: true, name: "X-Token-Count", operation: "set", value: "15" },
      { enabled: true, name: "Server-Timing", operation: "set", value: "token;dur=2" },
      { enabled: true, name: "Authorization", operation: "set", value: "" },
    ];
    input.profiles[0]!.responseHeaderModGroups = [];
    const result = sanitizeProfileExport(input);
    expect(result.sensitiveHeaderCount).toBe(0);
    expect(JSON.stringify(result.exchange)).toContain("token;dur=2");
    expect(result.exchange.profiles[0]?.requestHeaderModGroups?.[0]?.items[0]).toMatchObject({ value: "15" });
  });

  it("limits the UTF-8 size of actual sanitized exports to the importer limit", () => {
    const input = exchange();
    input.profiles[0]!.name = "界".repeat(400_000);
    expect(() => serializeProfileExport(input)).toThrow(RangeError);
    input.profiles[0]!.name = "small export";
    expect(serializeProfileExport(input)).not.toContain("Bearer private");
  });
});
