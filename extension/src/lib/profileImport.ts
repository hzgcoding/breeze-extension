import type { ProfileExchange, ProfileWithoutIds } from "./schema";
import { MAX_PROFILE_IMPORT_BYTES } from "./const";
import { isValidHeaderName, isValidHeaderValue } from "./headerInput";
import { profileExchangeZodSchema, restoreProfileExchange } from "./schema";

export { MAX_PROFILE_IMPORT_BYTES } from "./const";

export interface ProfileImportIssue {
  path: string;
  message: string;
}

export type ProfileImportInspection
  = | { status: "empty" | "invalidJson" | "tooLarge"; issues: ProfileImportIssue[] }
    | { status: "invalid"; issues: ProfileImportIssue[] }
    | { status: "ready"; issues: ProfileImportIssue[]; exchange: ProfileExchange; enabledCount: number };

interface Group {
  type: "radio" | "checkbox";
  items: { enabled: boolean }[];
}

function inspectSemantics(exchange: ProfileExchange) {
  const issues: ProfileImportIssue[] = [];
  const issue = (path: string, message: string) => issues.push({ path, message });

  function single(items: { enabled: boolean }[] | undefined, path: string) {
    if (items && items.filter(item => item.enabled).length > 1) {
      issue(path, "Only one item may be enabled in a radio group.");
    }
  }

  function radio(group: Group | undefined, path: string) {
    if (group?.type === "radio")
      single(group.items, path);
  }

  function activeValues(group: { items: { enabled: boolean; value: unknown[] }[] } | undefined) {
    return group?.items.filter(item => item.enabled).flatMap(item => item.value) ?? [];
  }

  exchange.profiles.forEach((profile: ProfileWithoutIds, index) => {
    const path = `profiles.${index}`;
    if (profile.priority !== undefined && profile.priority > 2 ** 31 - 1) {
      issue(`${path}.priority`, "Priority must be at most 2147483647.");
    }
    for (const key of ["requestHeaderModGroups", "responseHeaderModGroups"] as const) {
      profile[key]?.forEach((group, groupIndex) => {
        const groupPath = `${path}.${key}.${groupIndex}`;
        radio(group, groupPath);
        group.items.forEach((header, itemIndex) => {
          const emptyPlaceholder = header.name === "" && (header.operation === "remove" || header.value === "");
          if (!emptyPlaceholder && !isValidHeaderName(header.name)) {
            issue(`${groupPath}.items.${itemIndex}.name`, "Header names must be valid HTTP tokens.");
          }
          if (header.operation !== "remove" && !isValidHeaderValue(header.value)) {
            issue(`${groupPath}.items.${itemIndex}.value`, "Header values must not contain line breaks.");
          }
        });
      });
    }
    profile.syncCookieGroups?.forEach((group, groupIndex) => radio(group, `${path}.syncCookieGroups.${groupIndex}`));
    single(profile.redirectUrlGroup, `${path}.redirectUrlGroup`);
    single(profile.filters.urlFilter, `${path}.filters.urlFilter`);
    single(profile.filters.regexFilter, `${path}.filters.regexFilter`);
    Object.entries(profile.filters).forEach(([key, filter]) => {
      if (filter && "type" in filter && "items" in filter) {
        radio(filter, `${path}.filters.${key}`);
      }
    });
    for (const [include, exclude] of [["requestMethods", "excludedRequestMethods"], ["resourceTypes", "excludedResourceTypes"]] as const) {
      if (activeValues(profile.filters[include]).length && activeValues(profile.filters[exclude]).length) {
        issue(`${path}.filters.${exclude}`, `Use either ${include} or ${exclude}, not both.`);
      }
    }
    if (profile.ruleActionType === "allowAllRequests") {
      const resourceTypes = activeValues(profile.filters.resourceTypes);
      if (!resourceTypes.length || resourceTypes.some(type => type !== "main_frame" && type !== "sub_frame")) {
        issue(`${path}.filters.resourceTypes`, "Allow All Requests requires main_frame or sub_frame resource types only.");
      }
      if (activeValues(profile.filters.excludedResourceTypes).length) {
        issue(`${path}.filters.excludedResourceTypes`, "Allow All Requests cannot exclude resource types.");
      }
    }
  });
  return issues;
}

export function inspectProfileImport(json: string): ProfileImportInspection {
  if (json.length > MAX_PROFILE_IMPORT_BYTES || new TextEncoder().encode(json).byteLength > MAX_PROFILE_IMPORT_BYTES) {
    return { status: "tooLarge", issues: [] };
  }
  if (!json.trim())
    return { status: "empty", issues: [] };
  let input: unknown;
  try {
    input = JSON.parse(json);
  } catch {
    return { status: "invalidJson", issues: [] };
  }
  const result = profileExchangeZodSchema.safeParse(input);
  if (!result.success) {
    return { status: "invalid", issues: result.error.issues.map(error => ({ path: error.path.join("."), message: error.message })) };
  }
  const issues = inspectSemantics(result.data);
  if (issues.length)
    return { status: "invalid", issues };
  return { status: "ready", issues: [], exchange: result.data, enabledCount: result.data.profiles.filter(profile => profile.enabled).length };
}

/** Restore fresh identities only after the whole exchange passes preflight. */
export function prepareProfileImport(input: unknown, keepEnabled = false) {
  const exchange = profileExchangeZodSchema.parse(input);
  if (inspectSemantics(exchange).length) {
    throw new Error("Profile import failed semantic validation.");
  }
  const imported = restoreProfileExchange(exchange);
  if (!keepEnabled) {
    for (const group of imported.profileGroups) {
      const enabledIds = imported.profiles.filter(profile => profile.groupId === group.id && profile.enabled).map(profile => profile.id);
      if (enabledIds.length)
        group.lastEnabledProfileIds = enabledIds;
    }
    imported.profiles.forEach(profile => profile.enabled = false);
  }
  return imported;
}
