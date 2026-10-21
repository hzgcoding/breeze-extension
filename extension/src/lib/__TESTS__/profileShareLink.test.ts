import { Buffer } from "node:buffer";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { MAX_PROFILE_IMPORT_BYTES } from "../const";
import { SHARE_PAGE_URL } from "../product";
import { decodeProfileSharePayload } from "../profileShare";
import { createProfileShareLink, getProfileSharePayload } from "../profileShareLink";

describe("private profile share links", () => {
  it("keeps the complete compressed JSON in the fragment, outside the HTTP URL", async () => {
    const json = JSON.stringify({ version: 1, profiles: [{ name: "旧版分享" }] });
    const link = new URL(await createProfileShareLink(json));
    expect(`${link.origin}${link.pathname}${link.search}`).toBe(SHARE_PAGE_URL);
    expect(link.search).toBe("");
    expect(link.hash).toMatch(/^#profiles=[\w-]+$/);
    expect(await decodeProfileSharePayload(link.hash.slice("#profiles=".length))).toBe(json);
  });

  it("accepts the existing gzip and unpadded Base64URL payload without changing it", () => {
    const payload = gzipSync(Buffer.from("{\"version\":1,\"profiles\":[]}")).toString("base64url");
    expect(getProfileSharePayload(`${SHARE_PAGE_URL}#profiles=${payload}`)).toBe(payload);
    expect(getProfileSharePayload(new URL(`${SHARE_PAGE_URL}#profiles=YWJj`))).toBe("YWJj");
  });

  it("accepts VitePress's canonical clean URL without widening the origin or path", () => {
    expect(getProfileSharePayload(`${SHARE_PAGE_URL.replace(/\.html$/, "")}#profiles=YWJj`)).toBe("YWJj");
  });

  it.each([
    "https://hzgcoding.github.io/breeze/share/extra#profiles=YWJj",
    "https://hzgcoding.github.io/breeze/share.other#profiles=YWJj",
    `https://example.com${new URL(SHARE_PAGE_URL).pathname}#profiles=YWJj`,
    `${SHARE_PAGE_URL}/extra#profiles=YWJj`,
    `${SHARE_PAGE_URL}.other#profiles=YWJj`,
    `${SHARE_PAGE_URL.replace("https:", "http:")}#profiles=YWJj`,
    `${SHARE_PAGE_URL.replace("https://", "https://user:secret@")}#profiles=YWJj`,
    "not a URL",
  ])("rejects unrelated share locations: %s", (url) => {
    expect(getProfileSharePayload(url)).toBeNull();
  });

  it.each([
    "",
    "?profiles=YWJj",
    "?tracking=1#profiles=YWJj",
    "#profiles=",
    "#profiles=a",
    "#profiles=YQ==",
    "#profiles=a+b/",
    "#profiles=%59WJj",
    "#other=YWJj",
    "#profiles=YWJj&profiles=YWJj",
    "#profiles=YWJj&next=/other",
  ])("rejects malformed or ambiguous payloads: %s", (suffix) => {
    expect(getProfileSharePayload(`${SHARE_PAGE_URL}${suffix}`)).toBeNull();
  });

  it("rejects oversized fragments before the decoder or extension messaging receives them", () => {
    expect(getProfileSharePayload(`${SHARE_PAGE_URL}#profiles=${"a".repeat(MAX_PROFILE_IMPORT_BYTES * 2 + 1)}`)).toBeNull();
  });
});
