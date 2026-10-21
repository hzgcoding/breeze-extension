import { z } from "zod";
import { PROFILE_IMPORT_SCHEMA_VERSION } from "../const";
import {
  appendOrSetOperationSchema,
  headerModGroupSchema,
  profileGroupSchema,
  redirectUrlGroupItemSchema,
  removeOperationSchema,
  ruleActionTypeSchema,
  syncCookieGroupSchema,
  syncCookieSchema,
  uuidSchemaWithDefault,
} from "./base";
import { filterSchema, filterWithoutIdSchema } from "./filters";

export const profileSchema = z.object({
  id: uuidSchemaWithDefault,
  name: z.string(),
  enabled: z.boolean(),
  emoji: z.string(),
  groupId: z.uuid().optional(),
  comments: z.string().optional(),
  ruleActionType: ruleActionTypeSchema,
  priority: z.int().min(1).optional().meta({ description: "Range: 1 to 2^31 - 1, default: 1" }),
  requestHeaderModGroups: z.array(headerModGroupSchema).optional(),
  responseHeaderModGroups: z.array(headerModGroupSchema).optional(),
  syncCookieGroups: z.array(syncCookieGroupSchema).optional(),
  redirectUrlGroup: z.array(redirectUrlGroupItemSchema).optional(),
  filters: filterSchema,
});

const removeOperationWithoutIdSchema = removeOperationSchema.omit({ id: true });
const appendOrSetOperationWithoutIdSchema = appendOrSetOperationSchema.omit({ id: true });

const headerModWithoutIdSchema = z.union([
  removeOperationWithoutIdSchema,
  appendOrSetOperationWithoutIdSchema,
]);

const headerModGroupWithoutIdSchema = headerModGroupSchema.omit({ id: true }).extend({
  items: z.array(headerModWithoutIdSchema),
});

const syncCookieWithoutIdSchema = syncCookieSchema.omit({ id: true });

const syncCookieGroupWithoutIdSchema = syncCookieGroupSchema.omit({ id: true }).extend({
  items: z.array(syncCookieWithoutIdSchema),
});

const redirectUrlGroupItemWithoutIdSchema = redirectUrlGroupItemSchema.omit({ id: true });

export const profileWithoutIdsZodSchema = profileSchema.omit({ groupId: true, id: true }).extend({
  requestHeaderModGroups: z.array(headerModGroupWithoutIdSchema).optional(),
  responseHeaderModGroups: z.array(headerModGroupWithoutIdSchema).optional(),
  syncCookieGroups: z.array(syncCookieGroupWithoutIdSchema).optional(),
  redirectUrlGroup: z.array(redirectUrlGroupItemWithoutIdSchema).optional(),
  filters: filterWithoutIdSchema,
});

const profilesWithoutIdsArrayZodSchema = z.array(profileWithoutIdsZodSchema).min(1);

const legacyProfileExchangeZodSchema = z.object({
  version: z.literal(1),
  profiles: profilesWithoutIdsArrayZodSchema,
});

const exchangeRefSchema = z.string().min(1);
const exchangeProfileSchema = profileWithoutIdsZodSchema.extend({
  ref: exchangeRefSchema,
  groupRef: exchangeRefSchema.optional(),
});
const exchangeProfileGroupSchema = profileGroupSchema.omit({ id: true, lastEnabledProfileIds: true }).extend({
  ref: exchangeRefSchema,
  lastEnabledProfileRefs: z.array(exchangeRefSchema).optional(),
});

const currentProfileExchangeZodSchema = z.object({
  version: z.literal(PROFILE_IMPORT_SCHEMA_VERSION),
  profiles: z.array(exchangeProfileSchema).min(1),
  profileGroups: z.array(exchangeProfileGroupSchema),
}).superRefine((exchange, context) => {
  const profileRefs = new Map<string, z.infer<typeof exchangeProfileSchema>>();
  const groupRefs = new Set<string>();
  exchange.profiles.forEach((profile, index) => {
    if (profileRefs.has(profile.ref)) {
      context.addIssue({ code: "custom", path: ["profiles", index, "ref"], message: "Profile references must be unique" });
    }
    profileRefs.set(profile.ref, profile);
  });
  exchange.profileGroups.forEach((group, index) => {
    if (groupRefs.has(group.ref)) {
      context.addIssue({ code: "custom", path: ["profileGroups", index, "ref"], message: "Group references must be unique" });
    }
    groupRefs.add(group.ref);
  });
  exchange.profiles.forEach((profile, index) => {
    if (profile.groupRef && !groupRefs.has(profile.groupRef)) {
      context.addIssue({ code: "custom", path: ["profiles", index, "groupRef"], message: "Group reference must refer to an exported group" });
    }
  });
  exchange.profileGroups.forEach((group, index) => {
    const rememberedRefs = new Set<string>();
    group.lastEnabledProfileRefs?.forEach((ref, rememberedIndex) => {
      if (profileRefs.get(ref)?.groupRef !== group.ref || rememberedRefs.has(ref)) {
        context.addIssue({ code: "custom", path: ["profileGroups", index, "lastEnabledProfileRefs", rememberedIndex], message: "Remembered references must be unique members of this group" });
      }
      rememberedRefs.add(ref);
    });
    if (group.type === "radio" && exchange.profiles.filter(profile => profile.groupRef === group.ref && profile.enabled).length > 1) {
      context.addIssue({ code: "custom", path: ["profileGroups", index, "type"], message: "Radio groups can have at most one enabled profile" });
    }
  });
});

export const profileExchangeZodSchema = z.discriminatedUnion("version", [legacyProfileExchangeZodSchema, currentProfileExchangeZodSchema]);

export const profileExchangeJsonSchema = z.toJSONSchema(profileExchangeZodSchema);

/**
 * Strip all id fields from profile.
 * Uses Zod parsing to automatically strip fields not defined in the schema.
 */
export function stripProfileIds(profile: z.infer<typeof profileSchema>) {
  return profileWithoutIdsZodSchema.parse(profile);
}

export function createProfileExchange(
  profiles: z.infer<typeof profileSchema>[],
  profileGroups: z.infer<typeof profileGroupSchema>[] = [],
) {
  const usedGroupIds = new Set(profiles.flatMap(profile => profile.groupId ?? []));
  const selectedGroups = profileGroups.filter(group => usedGroupIds.has(group.id));
  const groupRefs = new Map(selectedGroups.map((group, index) => [group.id, `group-${index + 1}`]));
  const profileRefs = new Map(profiles.map((profile, index) => [profile.id, `profile-${index + 1}`]));
  const selectedProfiles = new Map(profiles.map(profile => [profile.id, profile]));

  return currentProfileExchangeZodSchema.parse({
    version: PROFILE_IMPORT_SCHEMA_VERSION,
    profiles: profiles.map(profile => ({
      ...stripProfileIds(profile),
      ref: profileRefs.get(profile.id),
      groupRef: profile.groupId ? groupRefs.get(profile.groupId) : undefined,
    })),
    profileGroups: selectedGroups.map(group => ({
      name: group.name,
      color: group.color,
      type: group.type,
      ref: groupRefs.get(group.id),
      lastEnabledProfileRefs: group.lastEnabledProfileIds === undefined
        ? undefined
        : [...new Set(group.lastEnabledProfileIds)]
            .filter(id => selectedProfiles.get(id)?.groupId === group.id)
            .map(id => profileRefs.get(id)),
    })),
  });
}

/** Restore an exchange into new local identities, never reusing source IDs. */
export function restoreProfileExchange(input: unknown) {
  const exchange = profileExchangeZodSchema.parse(input);
  if (exchange.version === 1) {
    return { profiles: exchange.profiles.map(addProfileIds), profileGroups: [] };
  }

  const profileGroups = exchange.profileGroups.map(group => profileGroupSchema.parse(group));
  const groupIds = new Map(exchange.profileGroups.map((group, index) => [group.ref, profileGroups[index]!.id]));
  const profiles = exchange.profiles.map(profile => profileSchema.parse({
    ...profile,
    groupId: profile.groupRef ? groupIds.get(profile.groupRef) : undefined,
  }));
  const profileIds = new Map(exchange.profiles.map((profile, index) => [profile.ref, profiles[index]!.id]));
  exchange.profileGroups.forEach((group, index) => {
    if (group.lastEnabledProfileRefs !== undefined) {
      profileGroups[index]!.lastEnabledProfileIds = group.lastEnabledProfileRefs.map(ref => profileIds.get(ref)!);
    }
  });
  return { profiles, profileGroups };
}

/**
 * Add id fields to profile.
 * Uses z.default() in the schema to automatically generate new UUIDs.
 */
export function addProfileIds(profileWithoutIds: z.infer<typeof profileWithoutIdsZodSchema>) {
  return profileSchema.parse(profileWithoutIds);
}
