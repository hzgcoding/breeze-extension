import { MAX_PROFILE_IMPORT_BYTES } from "./const";
import { SHARE_PAGE_URL } from "./product";
import { encodeProfileSharePayload } from "./profileShare";

const sharePage = new URL(SHARE_PAGE_URL);
const sharePaths = new Set([sharePage.pathname, sharePage.pathname.replace(/\.html$/, "")]);
const fragmentPrefix = "#profiles=";

export async function createProfileShareLink(json: string) {
  return `${SHARE_PAGE_URL}${fragmentPrefix}${await encodeProfileSharePayload(json)}`;
}

export function getProfileSharePayload(input: string | URL): string | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.origin !== sharePage.origin || !sharePaths.has(url.pathname)
    || url.username || url.password || url.search || !url.hash.startsWith(fragmentPrefix)) {
    return null;
  }
  const payload = url.hash.slice(fragmentPrefix.length);
  if (!payload || payload.length > MAX_PROFILE_IMPORT_BYTES * 2
    || payload.length % 4 === 1 || !/^[\w-]+$/.test(payload)) {
    return null;
  }
  return payload;
}
