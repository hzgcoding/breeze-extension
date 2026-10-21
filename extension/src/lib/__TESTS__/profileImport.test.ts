import { describe, expect, it } from "vitest";
import { inspectProfileImport, MAX_PROFILE_IMPORT_BYTES, prepareProfileImport } from "../profileImport";

function portable(overrides: Record<string, unknown> = {}) {
  return {
    name: "Imported",
    enabled: true,
    emoji: "I",
    ruleActionType: "modifyHeaders",
    filters: {},
    requestHeaderModGroups: [{ type: "checkbox", items: [{ enabled: true, name: "X-Test", operation: "set", value: "works" }] }],
    ...overrides,
  };
}

function inspect(overrides: Record<string, unknown>) {
  return inspectProfileImport(JSON.stringify({ version: 1, profiles: [portable(overrides)] }));
}

describe("profile import preflight", () => {
  it("bounds JSON input by UTF-8 bytes before parsing", () => {
    expect(inspectProfileImport(" ".repeat(MAX_PROFILE_IMPORT_BYTES + 1)).status).toBe("tooLarge");
    expect(inspectProfileImport("界".repeat(MAX_PROFILE_IMPORT_BYTES / 2)).status).toBe("tooLarge");
  });
  it("distinguishes empty, invalid JSON, invalid schema and valid input without echoing secrets", () => {
    expect(inspectProfileImport("").status).toBe("empty");
    expect(inspectProfileImport("Bearer secret is not JSON").status).toBe("invalidJson");
    const invalid = inspectProfileImport(JSON.stringify({ version: 999, profiles: [] }));
    expect(invalid.status).toBe("invalid");
    expect(inspect({}).status).toBe("ready");
    expect(JSON.stringify(inspectProfileImport("Bearer secret is not JSON"))).not.toContain("Bearer secret");
  });

  it.each(["requestHeaderModGroups", "responseHeaderModGroups", "syncCookieGroups"])("rejects multiple enabled radio items in %s", (key) => {
    const entry = key === "syncCookieGroups"
      ? { enabled: true, domain: "example.com", name: "session", value: "secret", path: "/" }
      : { enabled: true, name: "X-Test", operation: "set", value: "secret" };
    const result = inspect({ [key]: [{ type: "radio", items: [entry, entry] }] });
    expect(result.status).toBe("invalid");
    expect(result.issues.some(issue => issue.path.includes(key))).toBe(true);
    expect(JSON.stringify(result.issues)).not.toContain("secret");
  });

  it("rejects radio filters and single-selection lists with multiple enabled items", () => {
    expect(inspect({ filters: { requestDomains: { type: "radio", items: [{ enabled: true, value: "one.test" }, { enabled: true, value: "two.test" }] } } }).status).toBe("invalid");
    expect(inspect({ filters: { urlFilter: [{ enabled: true, value: "one" }, { enabled: true, value: "two" }] } }).status).toBe("invalid");
    expect(inspect({ redirectUrlGroup: [{ enabled: true, value: "https://one.test" }, { enabled: true, value: "https://two.test" }] }).status).toBe("invalid");
  });

  it.each([
    ["requestMethods", "excludedRequestMethods", ["get"]],
    ["resourceTypes", "excludedResourceTypes", ["script"]],
  ])("rejects active %s and %s together", (include, exclude, value) => {
    const active = { type: "checkbox", items: [{ enabled: true, value }] };
    expect(inspect({ filters: { [include]: active, [exclude]: active } }).status).toBe("invalid");
    expect(inspect({ filters: { [include]: active, [exclude]: { ...active, items: [{ enabled: false, value }] } } }).status).toBe("ready");
  });

  it("keeps intentional regex precedence and overlapping domain exclusions compatible", () => {
    const domain = { type: "checkbox", items: [{ enabled: true, value: "example.com" }] };
    expect(inspect({ filters: {
      urlFilter: [{ enabled: true, value: "example" }],
      regexFilter: [{ enabled: true, value: "example" }],
      requestDomains: domain,
      excludedRequestDomains: domain,
    } }).status).toBe("ready");
  });

  it("rejects invalid Header names and CRLF values but permits empty editing placeholders", () => {
    expect(inspect({ requestHeaderModGroups: [{ type: "checkbox", items: [{ enabled: false, name: "Bad Header", operation: "remove" }] }] }).status).toBe("invalid");
    expect(inspect({ requestHeaderModGroups: [{ type: "checkbox", items: [{ enabled: true, name: "Authorization", operation: "set", value: "secret\r\nX-Injected: yes" }] }] }).status).toBe("invalid");
    expect(inspect({ requestHeaderModGroups: [{ type: "checkbox", items: [{ enabled: true, name: "", operation: "set", value: "" }] }] }).status).toBe("ready");
  });

  it("validates DNR priority and allowAllRequests frame-only resource conditions", () => {
    expect(inspect({ priority: 2 ** 31 }).status).toBe("invalid");
    expect(inspect({ priority: 2 ** 31 - 1 }).status).toBe("ready");
    expect(inspect({ ruleActionType: "allowAllRequests" }).status).toBe("invalid");
    expect(inspect({ ruleActionType: "allowAllRequests", filters: { resourceTypes: { type: "checkbox", items: [{ enabled: true, value: ["script"] }] } } }).status).toBe("invalid");
    expect(inspect({ ruleActionType: "allowAllRequests", filters: { resourceTypes: { type: "checkbox", items: [{ enabled: true, value: ["main_frame"] }] } } }).status).toBe("ready");
  });

  it("restores fresh paused profiles without mutating input and allows explicit preservation of file enablement", () => {
    const input = { version: 1, profiles: [portable(), portable({ name: "Already paused", enabled: false })] };
    const before = structuredClone(input);
    const paused = prepareProfileImport(input);
    expect(paused.profiles.map(profile => profile.enabled)).toEqual([false, false]);
    const enabled = prepareProfileImport(input, true);
    expect(enabled.profiles.map(profile => profile.enabled)).toEqual([true, false]);
    expect(paused.profiles[0]!.id).not.toBe(enabled.profiles[0]!.id);
    expect(input).toEqual(before);
  });

  it("retains the intended group resume selection when pausing enabled imports", () => {
    const restored = prepareProfileImport({
      version: 2,
      profiles: [
        { ...portable(), ref: "dev", groupRef: "env" },
        { ...portable({ enabled: false }), ref: "stage", groupRef: "env" },
      ],
      profileGroups: [{ ref: "env", name: "Environments", color: "red", type: "radio" }],
    });
    expect(restored.profiles.every(profile => !profile.enabled)).toBe(true);
    expect(restored.profileGroups[0]!.lastEnabledProfileIds).toEqual([restored.profiles[0]!.id]);
  });

  it("rejects invalid input before restoring any profiles", () => {
    expect(() => prepareProfileImport({ version: 1, profiles: [portable(), portable({ priority: 2 ** 31 })] })).toThrow();
  });
});
