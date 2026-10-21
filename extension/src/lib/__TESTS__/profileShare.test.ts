import { Buffer } from "node:buffer";
import { gunzipSync, gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { MAX_PROFILE_IMPORT_BYTES } from "../profileImport";
import { decodeProfileSharePayload, encodeProfileSharePayload } from "../profileShare";

describe("bounded profile sharing", () => {
  it("works without the newer typed-array Base64 APIs", async () => {
    const targets = [[Uint8Array.prototype, "toBase64"], [Uint8Array, "fromBase64"]] as const;
    const descriptors = targets.map(([target, key]) => Object.getOwnPropertyDescriptor(target, key));
    targets.forEach(([target, key]) => Object.defineProperty(target, key, { configurable: true, value: undefined }));
    try {
      const text = JSON.stringify({ name: "Node 24 compatible" });
      expect(await decodeProfileSharePayload(await encodeProfileSharePayload(text))).toBe(text);
    } finally {
      targets.forEach(([target, key], index) => {
        const descriptor = descriptors[index];
        if (descriptor)
          Object.defineProperty(target, key, descriptor);
        else Reflect.deleteProperty(target, key);
      });
    }
  });

  it("keeps the existing gzip and unpadded Base64URL wire format interoperable", async () => {
    const text = JSON.stringify({ name: "旧版分享", value: "😀:/+=" });
    expect(await decodeProfileSharePayload(gzipSync(Buffer.from(text)).toString("base64url"))).toBe(text);
    const encoded = await encodeProfileSharePayload(text);
    expect(encoded).toMatch(/^[\w-]+$/);
    expect(gunzipSync(Buffer.from(encoded, "base64url")).toString("utf8")).toBe(text);
  });

  it("round trips UTF-8 JSON", async () => {
    const text = JSON.stringify({ name: "开发环境", value: "with:colons" });
    expect(await decodeProfileSharePayload(await encodeProfileSharePayload(text))).toBe(text);
  });

  it("rejects compressed expansion above the import limit", async () => {
    const payload = gzipSync(Buffer.from("x".repeat(MAX_PROFILE_IMPORT_BYTES + 1))).toString("base64url");
    await expect(decodeProfileSharePayload(payload)).rejects.toThrow(/limit/i);
  });

  it("rejects oversized encoded data before decoding", async () => {
    await expect(decodeProfileSharePayload("a".repeat(MAX_PROFILE_IMPORT_BYTES * 2 + 1))).rejects.toThrow(/limit/i);
  });

  it("rejects share creation that exceeds the same UTF-8 limit", async () => {
    await expect(encodeProfileSharePayload("界".repeat(MAX_PROFILE_IMPORT_BYTES / 2))).rejects.toThrow(/limit/i);
  });
});
