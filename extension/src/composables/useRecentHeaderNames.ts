import type { Ref } from "vue";
import type { ActionType } from "@/lib/types";
import { useLocalStorage } from "@vueuse/core";
import { isValidHeaderName } from "@/lib/headerInput";

const RECENT_HEADER_NAMES_LIMIT = 3;
const RECENT_HEADER_NAMES_STORAGE_KEYS = {
  request: "recent-request-header-names",
  response: "recent-response-header-names",
} as const satisfies Record<ActionType, string>;
const recentHeaderNameRefs = new Map<ActionType, Ref<string[]>>();

export function addNameToRecentHeaderNames(recentHeaderNames: string[], name: string) {
  const validNames = [...new Set(recentHeaderNames.filter(isValidHeaderName).map(name => name.toLowerCase()))]
    .slice(0, RECENT_HEADER_NAMES_LIMIT);
  if (!isValidHeaderName(name))
    return validNames;

  const normalizedName = name.toLowerCase();
  if (validNames.includes(normalizedName))
    return validNames;

  return [
    normalizedName,
    ...validNames,
  ].slice(0, RECENT_HEADER_NAMES_LIMIT);
}

export function removeNameFromRecentHeaderNames(recentHeaderNames: string[], name: string) {
  const normalizedName = name.toLocaleLowerCase();
  return recentHeaderNames.filter(
    recentName => recentName.toLocaleLowerCase() !== normalizedName,
  );
}

function getRecentHeaderNameRef(actionType: ActionType) {
  const existingRef = recentHeaderNameRefs.get(actionType);
  if (existingRef)
    return existingRef;

  const recentHeaderNames = useLocalStorage<string[]>(
    RECENT_HEADER_NAMES_STORAGE_KEYS[actionType],
    [],
  );
  recentHeaderNames.value = addNameToRecentHeaderNames(recentHeaderNames.value, "");

  recentHeaderNameRefs.set(actionType, recentHeaderNames);
  return recentHeaderNames;
}

export function useRecentHeaderNames(actionType: ActionType) {
  const recentHeaderNames = getRecentHeaderNameRef(actionType);

  function addRecentHeaderName(name: string) {
    addRecentHeaderNames([name]);
  }

  function addRecentHeaderNames(names: string[]) {
    recentHeaderNames.value = names.reduce(addNameToRecentHeaderNames, recentHeaderNames.value);
  }

  function removeRecentHeaderName(name: string) {
    recentHeaderNames.value = removeNameFromRecentHeaderNames(recentHeaderNames.value, name);
  }

  return {
    recentHeaderNames,
    addRecentHeaderName,
    addRecentHeaderNames,
    removeRecentHeaderName,
  };
}
