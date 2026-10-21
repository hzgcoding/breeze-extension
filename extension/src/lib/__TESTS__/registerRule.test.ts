import type { Profile } from "../schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateRules } from "@/entrypoints/background/DNR/registerRule";
import { createHeaderMod, createProfile } from "../profileFactory";
import { useProfileId2ErrorMessageRecordStorage, useProfileId2RelatedRuleIdRecordStorage } from "../storage";

const { item: registrations } = useProfileId2RelatedRuleIdRecordStorage();
const { item: errors } = useProfileId2ErrorMessageRecordStorage();
let dynamicRules: Browser.declarativeNetRequest.Rule[];
let sessionRules: Browser.declarativeNetRequest.Rule[];

function applyUpdate(rules: Browser.declarativeNetRequest.Rule[], options: Browser.declarativeNetRequest.UpdateRuleOptions) {
  // Chrome readback omits undefined properties from the submitted rule.
  return JSON.parse(JSON.stringify([
    ...rules.filter(rule => !options.removeRuleIds?.includes(rule.id)),
    ...(options.addRules ?? []),
  ])) as Browser.declarativeNetRequest.Rule[];
}

beforeEach(async () => {
  vi.restoreAllMocks();
  dynamicRules = [];
  sessionRules = [];
  await registrations.setValue({});
  await errors.setValue({});
  vi.spyOn(browser.declarativeNetRequest, "getDynamicRules").mockImplementation(async () => structuredClone(dynamicRules));
  vi.spyOn(browser.declarativeNetRequest, "getSessionRules").mockImplementation(async () => structuredClone(sessionRules));
  vi.spyOn(browser.declarativeNetRequest, "updateDynamicRules").mockImplementation(async (options) => {
    dynamicRules = applyUpdate(dynamicRules, options);
  });
  vi.spyOn(browser.declarativeNetRequest, "updateSessionRules").mockImplementation(async (options) => {
    sessionRules = applyUpdate(sessionRules, options);
  });
});

describe("rule registration idempotence", () => {
  it("preserves frame allowances by skipping duplicate registration passes and clears stale errors", async () => {
    const profiles = [
      createProfile({ ruleActionType: "block", priority: 1 }),
      createProfile({
        ruleActionType: "allowAllRequests",
        priority: 2,
        filters: { resourceTypes: { type: "checkbox", items: [{ id: "frame", enabled: true, value: ["main_frame"] }] } },
      }),
    ];
    await updateRules({ created: profiles });
    const originalRules = structuredClone(dynamicRules);
    const originalMapping = await registrations.getValue();
    await errors.setValue({ [profiles[0]!.id]: "Stale registration error" });

    await updateRules({ created: profiles });

    expect(browser.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledTimes(2);
    expect(dynamicRules).toEqual(originalRules);
    expect(await registrations.getValue()).toEqual(originalMapping);
    expect(await errors.getValue()).toEqual({});
  });

  it("recognizes unchanged header rules after browser serialization", async () => {
    const profile = createProfile({ requestHeaderModGroups: [{
      id: "headers",
      type: "checkbox",
      items: [createHeaderMod({ name: "X-Environment", value: "staging" })],
    }] });
    await updateRules({ created: [profile] });
    expect(dynamicRules[0]!.action).not.toHaveProperty("responseHeaders");

    await updateRules({ modified: [profile] });

    expect(browser.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledOnce();
  });

  it("repairs a mapped rule that is missing from the browser", async () => {
    const profile = createProfile({ ruleActionType: "block" });
    await updateRules({ created: [profile] });
    dynamicRules = [];

    await updateRules({ created: [profile] });

    expect(browser.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledTimes(2);
    expect(dynamicRules).toHaveLength(1);
    expect((await registrations.getValue())[profile.id]!.ruleId).toBe(dynamicRules[0]!.id);
  });

  it.each([
    { ruleActionType: "allow" },
    { priority: 5 },
    { filters: { urlFilter: [{ id: "url", enabled: true, value: "example.com" }] } },
  ] satisfies Partial<Profile>[])("updates changed rule content: %j", async (change) => {
    const profile = createProfile({ ruleActionType: "block", priority: 1 });
    await updateRules({ created: [profile] });
    const originalRules = structuredClone(dynamicRules);

    await updateRules({ modified: [{ ...profile, ...change }] });

    expect(browser.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledTimes(2);
    expect(dynamicRules).toHaveLength(1);
    expect(dynamicRules).not.toEqual(originalRules);
  });

  it("moves an unchanged action between dynamic and session scope", async () => {
    const profile = createProfile({ ruleActionType: "block" });
    await updateRules({ created: [profile] });
    const tabProfile = { ...profile, filters: {
      tabIds: { type: "checkbox" as const, items: [{ id: "tab", enabled: true, value: [42] }] },
    } };

    await updateRules({ modified: [tabProfile] });
    await updateRules({ created: [tabProfile] });

    expect(dynamicRules).toEqual([]);
    expect(sessionRules).toHaveLength(1);
    expect(sessionRules[0]!.condition.tabIds).toEqual([42]);
    expect(browser.declarativeNetRequest.updateSessionRules).toHaveBeenCalledOnce();
    expect((await registrations.getValue())[profile.id]!.ruleScope).toBe("session");
  });
});
