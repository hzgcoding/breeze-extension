import type { ProfileManager } from "../types";
import { describe, expect, it } from "vitest";
import { createEnvironmentGroup, selectEnvironment } from "../environments";
import { createProfile } from "../profileFactory";

function manager(): ProfileManager {
  return {
    profileGroups: [{ id: "environments", name: "Environments", color: "#8ab4f8", type: "radio" }],
    profiles: [
      createProfile({ id: "boe", groupId: "environments", name: "BOE" }),
      createProfile({ id: "ppe", groupId: "environments", name: "PPE", enabled: false }),
      createProfile({ id: "debug", name: "Debug" }),
    ],
    selectedProfileId: "boe",
  };
}

describe("environment switching", () => {
  it("switches a whole profile and leaves unrelated profiles enabled", () => {
    const state = manager();
    expect(selectEnvironment(state, "environments", "ppe")).toBe(true);
    expect(state.profiles.map(profile => profile.enabled)).toEqual([false, true, true]);
    expect(state.selectedProfileId).toBe("ppe");
  });

  it("pauses an environment group and remembers its previous selection", () => {
    const state = manager();
    expect(selectEnvironment(state, "environments")).toBe(true);
    expect(state.profiles.map(profile => profile.enabled)).toEqual([false, false, true]);
    expect(state.profileGroups[0]?.lastEnabledProfileIds).toEqual(["boe"]);
    selectEnvironment(state, "environments", "ppe");
    expect(state.profileGroups[0]?.lastEnabledProfileIds).toBeUndefined();
  });

  it("rejects a profile outside the group without changing active rules", () => {
    const state = manager();
    expect(selectEnvironment(state, "environments", "debug")).toBe(false);
    expect(state.profiles.map(profile => profile.enabled)).toEqual([true, false, true]);
  });

  it("creates an exclusive group without enabling previously paused profiles", () => {
    const state = manager();
    state.profiles.forEach(profile => profile.enabled = false);
    const created = createEnvironmentGroup(state, " Release ", ["boe", "ppe"]);
    expect(created).toMatchObject({ name: "Release", type: "radio" });
    expect(state.profileGroups).toHaveLength(1);
    expect(state.profiles.slice(0, 2).map(profile => profile.groupId)).toEqual([created?.id, created?.id]);
    expect(state.profiles.every(profile => !profile.enabled)).toBe(true);
  });

  it("retains only one enabled member when grouping active profiles", () => {
    const state = manager();
    state.profiles[1]!.enabled = true;
    state.selectedProfileId = "ppe";
    createEnvironmentGroup(state, "Release", ["boe", "ppe"]);
    expect(state.profiles.map(profile => profile.enabled)).toEqual([false, true, true]);
  });

  it("rejects invalid grouping requests without changing memberships", () => {
    const state = manager();
    expect(createEnvironmentGroup(state, "", ["boe", "ppe"])).toBeUndefined();
    expect(createEnvironmentGroup(state, "Release", ["boe", "boe"])).toBeUndefined();
    expect(createEnvironmentGroup(state, "Release", ["boe", "missing"])).toBeUndefined();
    expect(state.profileGroups[0]?.id).toBe("environments");
  });

  it("preserves the remembered state of members left in a previous group", () => {
    const state = manager();
    state.profileGroups[0]!.type = "checkbox";
    state.profileGroups[0]!.lastEnabledProfileIds = ["boe", "ppe"];
    state.profiles.forEach(profile => profile.enabled = false);
    state.profiles.push(createProfile({ id: "extra", groupId: "environments", enabled: false }));
    createEnvironmentGroup(state, "Release", ["boe", "debug"]);
    expect(state.profileGroups.find(group => group.id === "environments")?.lastEnabledProfileIds).toEqual(["ppe"]);
  });
});
