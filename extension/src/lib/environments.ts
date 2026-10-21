import type { ProfileGroup } from "./schema";
import type { ProfileManager } from "./types";
import { uuidv7 } from "uuidv7";
import { PROFILE_GROUP_COLOR_PRESETS } from "./const";

export function selectEnvironment(manager: ProfileManager, groupId: string, profileId?: string): boolean {
  const group = manager.profileGroups.find(group => group.id === groupId && group.type === "radio");
  const members = manager.profiles.filter(profile => profile.groupId === groupId);
  if (!group || (profileId && !members.some(profile => profile.id === profileId)))
    return false;

  if (profileId) {
    delete group.lastEnabledProfileIds;
    manager.selectedProfileId = profileId;
  } else {
    const activeIds = members.filter(profile => profile.enabled).map(profile => profile.id);
    if (activeIds.length)
      group.lastEnabledProfileIds = activeIds;
  }
  members.forEach(profile => profile.enabled = profile.id === profileId);
  return true;
}

export function createEnvironmentGroup(manager: ProfileManager, name: string, profileIds: string[]): ProfileGroup | undefined {
  const ids = new Set(profileIds);
  const members = manager.profiles.filter(profile => ids.has(profile.id));
  if (!name.trim() || ids.size < 2 || members.length !== ids.size)
    return undefined;

  const activeMembers = members.filter(profile => profile.enabled);
  const activeProfile = activeMembers.find(profile => profile.id === manager.selectedProfileId) ?? activeMembers[0];
  const previousGroupIds = new Set(members.flatMap(profile => profile.groupId ?? []));
  const group: ProfileGroup = {
    id: uuidv7(),
    name: name.trim(),
    color: PROFILE_GROUP_COLOR_PRESETS[0]!,
    type: "radio",
  };

  members.forEach((profile) => {
    profile.groupId = group.id;
    profile.enabled = profile.id === activeProfile?.id;
  });
  manager.profileGroups.forEach((previousGroup) => {
    if (previousGroupIds.has(previousGroup.id) && previousGroup.lastEnabledProfileIds) {
      previousGroup.lastEnabledProfileIds = previousGroup.lastEnabledProfileIds.filter(id => !ids.has(id));
    }
  });
  manager.profileGroups = manager.profileGroups.filter(group => manager.profiles.some(profile => profile.groupId === group.id));
  manager.profileGroups.push(group);
  return group;
}
