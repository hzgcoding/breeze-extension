import type { Profile } from "@/lib/schema";
import { describe, expect, it } from "vitest";
import {
  checkProfileUrl,
  getPotentialHeaderConflicts,
  getProfileStatus,
} from "@/lib/profileDiagnostics";
import { createHeaderMod, createProfile } from "@/lib/profileFactory";

function profile(overrides: Partial<Profile> = {}) {
  return createProfile({
    name: "Development",
    filters: {},
    requestHeaderModGroups: [{
      id: "group",
      type: "checkbox",
      items: [createHeaderMod({ name: "Authorization", value: "secret" })],
    }],
    ...overrides,
  });
}

function domains(values: string[]) {
  return {
    type: "checkbox" as const,
    items: values.map(value => ({ id: value, enabled: true, value })),
  };
}

describe("profile registration diagnostics", () => {
  it("distinguishes global power, paused, missing operations, registration errors and registration state", () => {
    const active = profile();
    expect(getProfileStatus(active, { powerOn: false, registered: true })).toBe("global-off");
    expect(getProfileStatus(profile({ enabled: false }), { powerOn: true })).toBe("paused");
    expect(getProfileStatus(profile({ requestHeaderModGroups: [] }), { powerOn: true })).toBe("no-active-operations");
    expect(getProfileStatus(active, { powerOn: true, error: "Invalid rule", registered: true })).toBe("registration-error");
    expect(getProfileStatus(active, { powerOn: true })).toBe("pending");
    expect(getProfileStatus(active, { powerOn: true, registered: true })).toBe("registered");
  });

  it("recognizes implicit actions and ignores disabled header operations", () => {
    expect(getProfileStatus(profile({ ruleActionType: "block", requestHeaderModGroups: [] }), { powerOn: true })).toBe("pending");
    const disabled = profile();
    disabled.requestHeaderModGroups![0]!.items[0]!.enabled = false;
    expect(getProfileStatus(disabled, { powerOn: true })).toBe("no-active-operations");
  });

  it("marks invalid enabled edits before the background reports a registration error", () => {
    const invalid = profile();
    invalid.requestHeaderModGroups![0]!.items[0]!.name = "Bad Header";
    expect(getProfileStatus(invalid, { powerOn: true, registered: true })).toBe("invalid-operations");
    invalid.requestHeaderModGroups![0]!.items[0]!.enabled = false;
    expect(getProfileStatus(invalid, { powerOn: true })).toBe("no-active-operations");
  });
});

describe("local request domain check", () => {
  it("matches a domain and its subdomains without matching sibling suffixes", () => {
    const scoped = profile({ filters: { requestDomains: domains(["example.com"]) } });
    expect(checkProfileUrl(scoped, "https://api.example.com/v1").status).toBe("domain-match");
    expect(checkProfileUrl(scoped, "example.com").status).toBe("domain-match");
    expect(checkProfileUrl(scoped, "https://notexample.com").status).toBe("outside-domains");
  });

  it("applies exclusions before inclusions, including excluded subdomains", () => {
    const scoped = profile({ filters: {
      requestDomains: domains(["example.com"]),
      excludedRequestDomains: domains(["api.example.com"]),
    } });
    expect(checkProfileUrl(scoped, "https://child.api.example.com").status).toBe("excluded-domain");
    expect(checkProfileUrl(scoped, "https://www.example.com").status).toBe("domain-match");
  });

  it("uses punycode request hosts but does not silently rewrite invalid domain rules", () => {
    expect(checkProfileUrl(profile({ filters: { requestDomains: domains(["xn--bcher-kva.example"]) } }), "https://bücher.example").status).toBe("domain-match");
    for (const value of ["*.example.com", ".example.com", "https://example.com", "bücher.example"]) {
      expect(checkProfileUrl(profile({ filters: { requestDomains: domains([value]) } }), "https://example.com").status).toBe("unknown");
    }
  });

  it("ignores disabled domain rules and reports invalid URLs and absent operations", () => {
    const scoped = profile({ filters: { requestDomains: {
      type: "checkbox",
      items: [{ id: "disabled", enabled: false, value: "other.example" }],
    } } });
    expect(checkProfileUrl(scoped, "https://example.com").status).toBe("domain-match");
    expect(checkProfileUrl(scoped, "https://").status).toBe("invalid-url");
    expect(checkProfileUrl(profile({ requestHeaderModGroups: [] }), "https://example.com").status).toBe("no-active-operations");
  });

  it("reports request context and URL patterns as unknown even when the domain passes", () => {
    const scoped = profile({ filters: {
      requestDomains: domains(["example.com"]),
      urlFilter: [{ id: "url", enabled: true, value: "||example.com/*" }],
      regexFilter: [{ id: "regex", enabled: true, value: "example" }],
      initiatorDomains: domains(["app.example.com"]),
      resourceTypes: { type: "checkbox", items: [{ id: "resource", enabled: true, value: ["script"] }] },
      tabIds: { type: "checkbox", items: [{ id: "tab", enabled: true, value: [42] }] },
      requestMethods: { type: "checkbox", items: [{ id: "method", enabled: true, value: ["post"] }] },
    } });
    expect(checkProfileUrl(scoped, "https://example.com")).toEqual({
      status: "unknown",
      limitations: ["regex", "initiator", "resource", "method", "tab"],
    });
    expect(checkProfileUrl(scoped, "https://elsewhere.example").status).toBe("outside-domains");
  });

  it("keeps URL patterns, top frames, party relationship and empty tab bindings unknown", () => {
    expect(checkProfileUrl(profile({ filters: {
      urlFilter: [{ id: "url", enabled: true, value: "example.com" }],
      topDomains: domains(["example.com"]),
      domainType: { enabled: true, value: "firstParty" },
      tabIds: { type: "checkbox", items: [{ id: "empty", enabled: true, value: [] }] },
    } }), "https://example.com")).toEqual({
      status: "unknown",
      limitations: ["url-pattern", "top-frame", "party", "tab"],
    });
  });
});

describe("potential header conflicts", () => {
  it("reports duplicate writes inside one profile once per header and direction", () => {
    const selected = profile();
    selected.requestHeaderModGroups![0]!.items.push(
      createHeaderMod({ name: "authorization", operation: "remove" }),
      createHeaderMod({ name: "AUTHORIZATION", value: "another-secret" }),
    );
    expect(getPotentialHeaderConflicts(selected, [selected])).toEqual([{
      profileId: selected.id,
      profileName: "Development",
      headerName: "authorization",
      scope: "request",
    }]);
  });

  it("reports enabled same-header writes with profile names and no header values", () => {
    const selected = profile();
    const other = profile({ name: "Staging" });
    other.requestHeaderModGroups![0]!.items = [createHeaderMod({ name: "authorization", operation: "remove" })];
    expect(getPotentialHeaderConflicts(selected, [selected, other])).toEqual([{
      profileId: other.id,
      profileName: "Staging",
      headerName: "authorization",
      scope: "request",
    }]);
  });

  it("does not warn about paused profiles, append-only writes, or separate request/response headers", () => {
    const selected = profile();
    const paused = profile({ enabled: false });
    const response = profile({ requestHeaderModGroups: [], responseHeaderModGroups: selected.requestHeaderModGroups });
    expect(getPotentialHeaderConflicts(selected, [paused, response])).toEqual([]);
    selected.requestHeaderModGroups![0]!.items = [createHeaderMod({ name: "X-List", value: "one", operation: "append" })];
    const append = profile({ requestHeaderModGroups: selected.requestHeaderModGroups });
    expect(getPotentialHeaderConflicts(selected, [append])).toEqual([]);
  });

  it("proves disjoint domain scopes including exclusions but keeps uncertain URL overlaps", () => {
    const selected = profile({ filters: { requestDomains: domains(["api.example.com"]) } });
    const separate = profile({ filters: { requestDomains: domains(["other.example.com"]) } });
    const excludesSelected = profile({ filters: { excludedRequestDomains: domains(["example.com"]) } });
    expect(getPotentialHeaderConflicts(selected, [separate, excludesSelected])).toEqual([]);
    const possible = profile({ filters: {
      requestDomains: domains(["example.com"]),
      urlFilter: [{ id: "url", enabled: true, value: "unproven-pattern" }],
    } });
    expect(getPotentialHeaderConflicts(selected, [possible])).toHaveLength(1);
  });
});
