import type { ProfileGroup } from "../schema";
import { describe, expect, it } from "vitest";
import {
  createProfileExchange,
  profileExchangeJsonSchema,
  profileExchangeZodSchema,
  restoreProfileExchange,
  stripProfileIds,
} from "../schema";
import { mockProfile } from "./schema.fixtures";

const groupId = "550e8400-e29b-41d4-a716-446655440001";
const otherProfileId = "550e8400-e29b-41d4-a716-446655440002";
const excludedProfileId = "550e8400-e29b-41d4-a716-446655440003";
const environments: ProfileGroup = {
  id: groupId,
  name: "Environments",
  color: "#8ab4f8",
  type: "radio",
  lastEnabledProfileIds: [otherProfileId, excludedProfileId],
};
const development = { ...mockProfile, groupId, enabled: false, name: "Development" };
const staging = { ...development, id: otherProfileId, name: "Staging" };

describe("profile group exchange", () => {
  it("round trips group metadata, membership and remembered profiles using fresh local IDs", () => {
    const exchange = createProfileExchange([development, staging], [environments]);

    expect(exchange.version).toBe(2);
    expect(exchange.profiles.map(profile => profile.groupRef)).toEqual(["group-1", "group-1"]);
    expect(exchange.profileGroups).toEqual([{
      ref: "group-1",
      name: "Environments",
      color: "#8ab4f8",
      type: "radio",
      lastEnabledProfileRefs: ["profile-2"],
    }]);
    const serialized = JSON.stringify(exchange);
    expect(serialized).not.toContain(groupId);
    expect(serialized).not.toContain(mockProfile.id);
    expect(serialized).not.toContain(otherProfileId);
    expect(serialized).not.toContain(excludedProfileId);

    const restored = restoreProfileExchange(JSON.parse(serialized));
    expect(restored.profileGroups).toHaveLength(1);
    expect(restored.profileGroups[0]).toMatchObject({ name: "Environments", color: "#8ab4f8", type: "radio" });
    expect(restored.profileGroups[0]!.id).not.toBe(groupId);
    expect(restored.profiles.map(profile => profile.groupId)).toEqual([restored.profileGroups[0]!.id, restored.profileGroups[0]!.id]);
    expect(restored.profileGroups[0]!.lastEnabledProfileIds).toEqual([restored.profiles[1]!.id]);
    expect(restored.profiles[0]!.id).not.toBe(development.id);
    expect(restored.profiles[0]!.requestHeaderModGroups![0]!.id).not.toBe(development.requestHeaderModGroups![0]!.id);
    expect(restored.profiles[0]!.requestHeaderModGroups![0]!.items[0]!.id).not.toBe(development.requestHeaderModGroups![0]!.items[0]!.id);
    expect(restored.profiles[0]!.filters.urlFilter![0]!.id).not.toBe(development.filters.urlFilter![0]!.id);
    expect(restored.profiles[0]!.name).toBe("Development");
    expect(restored.profiles[0]!.enabled).toBe(false);
    expect(restored.profiles[0]!.filters).not.toHaveProperty("tabIds");

    const secondImport = restoreProfileExchange(exchange);
    expect(secondImport.profileGroups[0]!.id).not.toBe(restored.profileGroups[0]!.id);
    expect(secondImport.profiles[0]!.id).not.toBe(restored.profiles[0]!.id);
  });

  it("exports only selected group members and drops stale remembered membership", () => {
    const exchange = createProfileExchange([staging], [{
      ...environments,
      type: "checkbox",
      lastEnabledProfileIds: [development.id, staging.id, staging.id],
    }, { ...environments, id: excludedProfileId, name: "Not selected" }]);

    expect(exchange.profiles).toHaveLength(1);
    expect(exchange.profileGroups).toEqual([{
      ref: "group-1",
      name: "Environments",
      color: "#8ab4f8",
      type: "checkbox",
      lastEnabledProfileRefs: ["profile-1"],
    }]);
    expect(restoreProfileExchange(exchange).profileGroups[0]!.type).toBe("checkbox");
  });

  it("keeps ungrouped and orphaned profiles portable without dangling references", () => {
    const exchange = createProfileExchange([mockProfile, staging]);

    expect(exchange.profileGroups).toEqual([]);
    expect(exchange.profiles.every(profile => profile.groupRef === undefined)).toBe(true);
    expect(restoreProfileExchange(exchange).profiles.every(profile => profile.groupId === undefined)).toBe(true);
  });

  it("imports legacy version 1 exchanges with fresh IDs and no groups", () => {
    const legacy = { version: 1, profiles: [stripProfileIds(mockProfile)] };

    expect(profileExchangeZodSchema.safeParse(legacy).success).toBe(true);
    const restored = restoreProfileExchange(legacy);
    expect(restored.profileGroups).toEqual([]);
    expect(restored.profiles[0]!.id).not.toBe(mockProfile.id);
    expect(restored.profiles[0]!.name).toBe(mockProfile.name);
    expect(restored.profiles[0]).not.toHaveProperty("groupId");
  });

  it.each([
    ["dangling group membership", { profiles: [{ ...stripProfileIds(mockProfile), ref: "p", groupRef: "missing" }], profileGroups: [] }],
    ["duplicate profile references", { profiles: [{ ...stripProfileIds(mockProfile), ref: "p" }, { ...stripProfileIds(mockProfile), ref: "p" }], profileGroups: [] }],
    ["duplicate group references", { profiles: [{ ...stripProfileIds(mockProfile), ref: "p", groupRef: "g" }], profileGroups: [{ ref: "g", name: "One", color: "red", type: "checkbox" }, { ref: "g", name: "Two", color: "blue", type: "checkbox" }] }],
    ["dangling remembered profile", { profiles: [{ ...stripProfileIds(mockProfile), ref: "p", groupRef: "g" }], profileGroups: [{ ref: "g", name: "One", color: "red", type: "checkbox", lastEnabledProfileRefs: ["missing"] }] }],
    ["remembered profile outside its group", { profiles: [{ ...stripProfileIds(mockProfile), ref: "p" }], profileGroups: [{ ref: "g", name: "One", color: "red", type: "checkbox", lastEnabledProfileRefs: ["p"] }] }],
    ["multiple enabled radio members", { profiles: [{ ...stripProfileIds(mockProfile), ref: "p1", enabled: true, groupRef: "g" }, { ...stripProfileIds(mockProfile), ref: "p2", enabled: true, groupRef: "g" }], profileGroups: [{ ref: "g", name: "One", color: "red", type: "radio" }] }],
  ])("rejects %s instead of importing an inconsistent group", (_name, data) => {
    expect(profileExchangeZodSchema.safeParse({ version: 2, ...data }).success).toBe(false);
  });

  it("publishes structural JSON validation for current and legacy exchanges", () => {
    expect(profileExchangeJsonSchema).toMatchObject({
      oneOf: [
        { properties: { version: { const: 1 } }, required: ["version", "profiles"] },
        {
          properties: {
            version: { const: 2 },
            profiles: { items: { properties: { ref: { type: "string" }, groupRef: { type: "string" } } } },
            profileGroups: { items: { properties: { lastEnabledProfileRefs: { type: "array", items: { type: "string" } } } } },
          },
          required: ["version", "profiles", "profileGroups"],
        },
      ],
    });
  });
});
