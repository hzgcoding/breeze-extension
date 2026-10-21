import type { Profile } from "./schema";
import { buildRequestHeaders, buildResponseHeaders } from "@/entrypoints/background/DNR/buildAction";
import { hasRegisterableAction } from "@/entrypoints/background/profileRule";
import { isValidHeaderName, isValidHeaderValue } from "./headerInput";

export function getProfileStatus(profile: Profile, state: { powerOn: boolean; registered?: boolean; error?: string }) {
  if (!state.powerOn)
    return "global-off";
  if (!profile.enabled)
    return "paused";
  if (hasInvalidHeaderOperations(profile))
    return "invalid-operations";
  if (state.error)
    return "registration-error";
  if (!hasRegisterableAction(profile))
    return "no-active-operations";
  return state.registered ? "registered" : "pending";
}

function hasInvalidHeaderOperations(profile: Profile) {
  if (profile.ruleActionType !== "modifyHeaders")
    return false;
  return [...(profile.requestHeaderModGroups ?? []), ...(profile.responseHeaderModGroups ?? [])]
    .some(group => group.items.some((item) => {
      if (!item.enabled)
        return false;
      const hasValue = item.operation !== "remove" && item.value.length > 0;
      return ((item.name.length > 0 || hasValue) && !isValidHeaderName(item.name))
        || (item.operation !== "remove" && !isValidHeaderValue(item.value));
    }));
}

type Limitation = "url-pattern" | "regex" | "initiator" | "top-frame" | "party" | "resource" | "method" | "tab" | "domain-syntax" | "url-scheme" | "invalid-operations";
interface UrlCheck {
  status: "invalid-url" | "no-active-operations" | "excluded-domain" | "outside-domains" | "domain-match" | "unknown";
  limitations: Limitation[];
}

function enabledDomains(group: Profile["filters"]["requestDomains"]) {
  return group?.items.filter(item => item.enabled && item.value.trim())
    .map(item => item.value.trim().toLowerCase()) ?? [];
}

// Accept only literal ASCII domain entries. Rewriting wildcard, Unicode or URL
// entries here would disagree with the strings sent to DNR by buildCondition.
function isLiteralDomain(domain: string) {
  return /^[\w-]+(?:\.[\w-]+)*$/.test(domain);
}

function matchesDomain(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

function contextLimitations(filters: Profile["filters"]) {
  const limitations: Limitation[] = [];
  const regex = filters.regexFilter?.find(item => item.enabled)?.value.trim();
  const url = filters.urlFilter?.find(item => item.enabled)?.value.trim();
  if (regex)
    limitations.push("regex");
  else if (url)
    limitations.push("url-pattern");
  if ([filters.initiatorDomains, filters.excludedInitiatorDomains].some(group => enabledDomains(group).length > 0))
    limitations.push("initiator");
  if ([filters.topDomains, filters.excludedTopDomains].some(group => enabledDomains(group).length > 0))
    limitations.push("top-frame");
  if (filters.domainType?.enabled)
    limitations.push("party");
  if ([filters.resourceTypes, filters.excludedResourceTypes].some(group => group?.items.some(item => item.enabled && item.value.length > 0)))
    limitations.push("resource");
  if ([filters.requestMethods, filters.excludedRequestMethods].some(group => group?.items.some(item => item.enabled && item.value.length > 0)))
    limitations.push("method");
  if ([filters.tabIds, filters.excludedTabIds, filters.tabGroups, filters.excludedTabGroups].some(group => group?.items.some(item => item.enabled)))
    limitations.push("tab");
  return limitations;
}

/** Local domain eligibility only; never a simulation of Chrome's full matcher. */
export function checkProfileUrl(profile: Profile, input: string): UrlCheck {
  let url: URL;
  const value = input.trim();
  try {
    if (!value || /\s/.test(value))
      return { status: "invalid-url", limitations: [] };
    url = new URL(value.includes("://") ? value : `https://${value}`);
    if (!url.hostname)
      return { status: "invalid-url", limitations: [] };
  } catch {
    return { status: "invalid-url", limitations: [] };
  }
  if (hasInvalidHeaderOperations(profile))
    return { status: "unknown", limitations: ["invalid-operations"] };
  if (!hasRegisterableAction(profile))
    return { status: "no-active-operations", limitations: [] };
  if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol))
    return { status: "unknown", limitations: ["url-scheme"] };

  const included = enabledDomains(profile.filters.requestDomains);
  const excluded = enabledDomains(profile.filters.excludedRequestDomains);
  const host = url.hostname.toLowerCase();
  if (![host, ...included, ...excluded].every(isLiteralDomain))
    return { status: "unknown", limitations: ["domain-syntax"] };
  if (excluded.some(domain => matchesDomain(host, domain)))
    return { status: "excluded-domain", limitations: [] };
  if (included.length > 0 && !included.some(domain => matchesDomain(host, domain)))
    return { status: "outside-domains", limitations: [] };

  const limitations = contextLimitations(profile.filters);
  return { status: limitations.length ? "unknown" : "domain-match", limitations };
}

function mayOverlapDomains(first: Profile, second: Profile) {
  const firstIncluded = enabledDomains(first.filters.requestDomains);
  const secondIncluded = enabledDomains(second.filters.requestDomains);
  const excluded = [
    ...enabledDomains(first.filters.excludedRequestDomains),
    ...enabledDomains(second.filters.excludedRequestDomains),
  ];
  if (![...firstIncluded, ...secondIncluded, ...excluded].every(isLiteralDomain))
    return true;
  if (!firstIncluded.length && !secondIncluded.length)
    return true;

  let candidates = firstIncluded.length ? firstIncluded : secondIncluded;
  if (firstIncluded.length && secondIncluded.length) {
    candidates = firstIncluded.flatMap(firstDomain => secondIncluded.flatMap((secondDomain) => {
      if (matchesDomain(firstDomain, secondDomain))
        return [firstDomain];
      return matchesDomain(secondDomain, firstDomain) ? [secondDomain] : [];
    }));
  }
  return candidates.some(domain => !excluded.some(exclusion => matchesDomain(domain, exclusion)));
}

interface HeaderConflict {
  profileId: string;
  profileName: string;
  headerName: string;
  scope: "request" | "response";
}

/** Report possible competing writes without exposing any header values. */
export function getPotentialHeaderConflicts(profile: Profile, profiles: Profile[]): HeaderConflict[] {
  if (!profile.enabled || profile.ruleActionType !== "modifyHeaders")
    return [];
  const conflicts: HeaderConflict[] = [];
  const scopes = ["request", "response"] as const;
  for (const other of [profile, ...profiles.filter(candidate => candidate.id !== profile.id)]) {
    if (!other.enabled || other.ruleActionType !== "modifyHeaders" || !mayOverlapDomains(profile, other))
      continue;
    for (const scope of scopes) {
      const buildHeaders = scope === "request" ? buildRequestHeaders : buildResponseHeaders;
      const selectedHeaders = buildHeaders(profile);
      const otherHeaders = buildHeaders(other);
      const conflictingNames = new Set(selectedHeaders.filter((header, index) => otherHeaders.some((otherHeader, otherIndex) =>
        (other.id !== profile.id || index !== otherIndex)
        && header.header.toLowerCase() === otherHeader.header.toLowerCase()
        && (header.operation !== "append" || otherHeader.operation !== "append"),
      )).map(header => header.header.toLowerCase()));
      for (const headerName of conflictingNames) {
        conflicts.push({ profileId: other.id, profileName: other.name, headerName, scope });
      }
    }
  }
  return conflicts;
}
