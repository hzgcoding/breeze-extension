import { MAX_PROFILE_IMPORT_BYTES } from "./const";
import { profileExchangeZodSchema } from "./schema";

/** Validate and clone before changing any values; storage objects are never mutated. */
export function sanitizeProfileExport(input: unknown, retainSensitive = false) {
  const exchange = profileExchangeZodSchema.parse(input);
  let sensitiveHeaderCount = 0;
  const sensitiveHeaderNames = new Set<string>();

  for (const profile of exchange.profiles) {
    const groups = [...profile.requestHeaderModGroups ?? [], ...profile.responseHeaderModGroups ?? []];
    for (const group of groups) {
      for (const item of group.items) {
        const name = item.name.trim().toLowerCase();
        const sensitive = /^(?:proxy-)?authorization$|^(?:set-)?cookie$|(?:^|[-_])api[-_]?key$|(?:token|secret)$/.test(name);
        if (item.operation === "remove" || !sensitive || !item.value)
          continue;
        sensitiveHeaderCount++;
        sensitiveHeaderNames.add(name);
        if (!retainSensitive)
          item.value = "";
      }
    }
    for (const group of profile.syncCookieGroups ?? []) {
      for (const item of group.items)
        item.value = "";
    }
  }

  return { exchange, sensitiveHeaderCount, sensitiveHeaderNames: [...sensitiveHeaderNames].sort() };
}

export function serializeProfileExport(input: unknown, retainSensitive = false) {
  const json = JSON.stringify(sanitizeProfileExport(input, retainSensitive).exchange, null, 2);
  if (new TextEncoder().encode(json).byteLength > MAX_PROFILE_IMPORT_BYTES)
    throw new RangeError("Profile export exceeds size limit");
  return json;
}
