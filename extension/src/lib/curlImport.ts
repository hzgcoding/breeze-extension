import type { Profile } from "./schema";
import { uuidv7 } from "uuidv7";
import { curlTokens } from "./curlTokens";
import { isValidHeaderName } from "./headerInput";
import { createHeaderMod, createProfile } from "./profileFactory";
import { requestMethodSchema } from "./schema/base";

export type CurlError = "empty" | "syntax" | "command" | "option" | "url" | "header" | "method" | "file";
export type CurlWarning = "body" | "network" | "duplicate";
export interface CurlPreview {
  ok: true;
  domain: string;
  method: typeof requestMethodSchema._output;
  headers: { name: string; value: string }[];
  warnings: CurlWarning[];
}
export type CurlResult = CurlPreview | { ok: false; error: CurlError };

const headerOptions = new Map([
  ["-H", "header"],
  ["--header", "header"],
  ["-b", "Cookie"],
  ["--cookie", "Cookie"],
  ["-A", "User-Agent"],
  ["--user-agent", "User-Agent"],
  ["-e", "Referer"],
  ["--referer", "Referer"],
]);
const bodyOptions = new Set(["-d", "--data", "--data-raw", "--data-binary", "--data-urlencode", "--json"]);
const networkFlags = new Set(["--compressed", "--insecure", "-k", "--location", "-L", "--silent", "-s", "--show-error", "-S", "--fail", "-f", "--http1.1", "--http2", "--http2-prior-knowledge", "--globoff", "-g", "--verbose", "-v"]);
const networkOptions = new Set(["--connect-timeout", "--max-time", "-m", "--retry", "--retry-delay", "--retry-max-time", "--proxy", "-x", "--noproxy", "--resolve", "--connect-to"]);
const valueOptions = new Set([...headerOptions.keys(), ...bodyOptions, ...networkOptions, "-X", "--request", "--url"]);

/** Import a single Bash cURL request as data; no shell, files or fetch involved. */
export function parseCurl(source: string): CurlResult {
  if (!source.trim())
    return { ok: false, error: "empty" };
  const tokens = curlTokens(source);
  if (!tokens)
    return { ok: false, error: "syntax" };
  if (tokens.shift() !== "curl")
    return { ok: false, error: "command" };
  const headers = new Map<string, { name: string; value: string }>();
  const warnings = new Set<CurlWarning>();
  const urls: string[] = [];
  let explicitMethod: string | undefined;
  let hasBody = false;
  let headMode = false;
  let getMode = false;
  const addHeader = (name: string, value: string) => {
    if (!isValidHeaderName(name) || !value.trim() || [...value].some(char => (char.charCodeAt(0) < 32 && char !== "\t") || char.charCodeAt(0) === 127))
      return false;
    const key = name.toLowerCase();
    if (headers.has(key))
      warnings.add("duplicate");
    headers.set(key, { name, value });
    return true;
  };
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    if (!token.startsWith("-")) {
      urls.push(token);
      continue;
    }
    let option = token;
    let value: string | undefined;
    if (token.startsWith("--") && token.includes("=")) {
      const equals = token.indexOf("=");
      option = token.slice(0, equals);
      value = token.slice(equals + 1);
    } else if (!token.startsWith("--") && token.length > 2 && valueOptions.has(token.slice(0, 2))) {
      option = token.slice(0, 2);
      value = token.slice(2);
    }
    if (valueOptions.has(option)) {
      value ??= tokens[++index];
      if (value === undefined)
        return { ok: false, error: "option" };
    } else if (value !== undefined) {
      return { ok: false, error: "option" };
    }
    if (option === "--url") {
      urls.push(value!);
    } else if (option === "-X" || option === "--request") {
      explicitMethod = value!.toLowerCase();
    } else if (option === "-I" || option === "--head") {
      headMode = true;
    } else if (option === "-G" || option === "--get") {
      getMode = true;
    } else if (headerOptions.has(option)) {
      if (value!.startsWith("@"))
        return { ok: false, error: "file" };
      const headerName = headerOptions.get(option)!;
      if (headerName === "Cookie" && !value!.includes("="))
        return { ok: false, error: "file" };
      if (headerName === "header") {
        const colon = value!.indexOf(":");
        if (colon < 0)
          return { ok: false, error: "header" };
        const name = value!.slice(0, colon);
        const headerValue = value!.slice(colon + 1).replace(/^[\t ]+|[\t ]+$/g, "");
        // Empty sets are dropped by the existing DNR engine; never promise them.
        if (!addHeader(name, headerValue))
          return { ok: false, error: "header" };
      } else if (!addHeader(headerName, value!)) {
        return { ok: false, error: "header" };
      }
    } else if (bodyOptions.has(option)) {
      if (value!.startsWith("@") || (option === "--data-urlencode" && value!.includes("@")))
        return { ok: false, error: "file" };
      warnings.add("body");
      hasBody = true;
    } else if (networkFlags.has(option) || networkOptions.has(option)) {
      warnings.add("network");
    } else {
      return { ok: false, error: "option" };
    }
  }
  if (urls.length !== 1)
    return { ok: false, error: "url" };
  let url: URL;
  try {
    url = new URL(urls[0]!);
  } catch {
    return { ok: false, error: "url" };
  }
  if (!/^https?:$/.test(url.protocol) || !url.hostname || url.username || url.password || /[{}[\]\\\r\n]/.test(urls[0]!))
    return { ok: false, error: "url" };
  if (headMode && hasBody && !getMode)
    return { ok: false, error: "option" };
  let inferredMethod = "get";
  if (headMode)
    inferredMethod = "head";
  else if (hasBody && !getMode)
    inferredMethod = "post";
  const method = requestMethodSchema.safeParse(explicitMethod ?? inferredMethod);
  if (!method.success || method.data === "other")
    return { ok: false, error: "method" };
  if (!headers.size)
    return { ok: false, error: "header" };
  return { ok: true, domain: url.hostname, method: method.data, headers: [...headers.values()], warnings: [...warnings] };
}

export function createCurlProfile(preview: CurlPreview): Profile {
  return createProfile({
    name: `cURL · ${preview.domain}`,
    enabled: false,
    filters: {
      requestDomains: { type: "checkbox", items: [{ id: uuidv7(), enabled: true, value: preview.domain }] },
      requestMethods: { type: "checkbox", items: [{ id: uuidv7(), enabled: true, value: [preview.method] }] },
    },
    requestHeaderModGroups: [{
      id: uuidv7(),
      type: "checkbox",
      items: preview.headers.map(header => createHeaderMod(header)),
    }],
  });
}
