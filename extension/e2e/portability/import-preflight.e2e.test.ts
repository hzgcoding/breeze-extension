import { Buffer } from "node:buffer";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { MAX_PROFILE_IMPORT_BYTES } from "../../src/lib/profileImport";
import { setupExtensionSuite } from "../suite";
import { editorText, fetchEcho, profile, setEditorText } from "../test-util";

function exchange(overrides: Record<string, unknown> = {}) {
  return { version: 1, profiles: [{
    name: "Reviewed import",
    emoji: "I",
    enabled: true,
    ruleActionType: "modifyHeaders",
    filters: { requestDomains: { type: "checkbox", items: [{ enabled: true, value: "127.0.0.1" }] } },
    requestHeaderModGroups: [{ type: "checkbox", items: [{ enabled: true, name: "X-Reviewed", operation: "set", value: "works" }] }],
    ...overrides,
  }] };
}

describe("reviewed and paused profile imports", { concurrent: false }, () => {
  const state = setupExtensionSuite();

  it("previews an active legacy profile and imports it paused until explicitly enabled", async () => {
    const { extension, server } = state;
    const existing = profile({ name: "Existing paused profile", enabled: false, ruleActionType: "allow" });
    await extension.setProfiles([existing], 0);
    const popup = await extension.openExtensionPage("/import");
    await setEditorText(popup, JSON.stringify(exchange()));
    await expect.poll(() => popup.getByTestId("import-summary").textContent()).toContain("1 enabled in the file");
    expect(await popup.getByTestId("import-preflight").textContent()).toContain("127.0.0.1");
    expect(await popup.getByTestId("import-keep-enabled").getAttribute("data-state")).toBe("unchecked");
    await popup.getByTestId("import-confirm").click();
    await expect.poll(async () => (await extension.manager()).profiles).toHaveLength(2);
    const manager = await extension.manager();
    expect(manager.profiles.map(entry => entry.enabled)).toEqual([false, false]);
    expect(manager.selectedProfileId).toBe(manager.profiles[1]!.id);
    expect(await extension.ruleCount()).toBe(0);
    const page = await extension.context.newPage();
    await page.goto(`${server.loopbackOrigin}/page`);
    expect((await fetchEcho(page, `${server.loopbackOrigin}/echo`)).headers["x-reviewed"]).toBeUndefined();
    await popup.getByTestId(`profile-${manager.profiles[1]!.id}`).click({ modifiers: ["Shift"] });
    await expect.poll(async () => (await fetchEcho(page, `${server.loopbackOrigin}/echo`)).headers["x-reviewed"]).toBe("works");
    expect((await fetchEcho(page, `${server.localhostOrigin}/echo`)).headers["x-reviewed"]).toBeUndefined();
  });

  it("retains imported radio-group resume selection while pausing all members", async () => {
    const { extension } = state;
    await extension.setProfiles([profile({ enabled: false, ruleActionType: "allow" })], 0);
    const popup = await extension.openExtensionPage("/import");
    await setEditorText(popup, JSON.stringify({
      version: 2,
      profiles: [
        { ...exchange().profiles[0], ref: "dev", groupRef: "env", name: "Development" },
        { ...exchange().profiles[0], ref: "staging", groupRef: "env", name: "Staging", enabled: false },
      ],
      profileGroups: [{ ref: "env", name: "Imported environments", color: "red", type: "radio" }],
    }));
    await popup.getByTestId("import-confirm").click();
    await expect.poll(async () => (await extension.manager()).profiles).toHaveLength(3);
    const manager = await extension.manager();
    expect(manager.profiles.every(entry => !entry.enabled)).toBe(true);
    expect(manager.profileGroups[0]!.lastEnabledProfileIds).toEqual([manager.profiles[1]!.id]);
    expect(manager.profiles[1]!.groupId).toBe(manager.profileGroups[0]!.id);
    expect(manager.profiles[2]!.groupId).toBe(manager.profileGroups[0]!.id);
  });

  it("registers the source's enabled rules only after explicit activation consent", async () => {
    const { extension, server } = state;
    await extension.setProfiles([], 0);
    const popup = await extension.openExtensionPage("/import");
    await setEditorText(popup, JSON.stringify(exchange()));
    await popup.getByTestId("import-keep-enabled").click();
    await popup.getByTestId("import-confirm").click();
    const page = await extension.context.newPage();
    await page.goto(`${server.loopbackOrigin}/page`);
    await expect.poll(async () => (await fetchEcho(page, `${server.loopbackOrigin}/echo`)).headers["x-reviewed"]).toBe("works");
    expect((await fetchEcho(page, `${server.localhostOrigin}/echo`)).headers["x-reviewed"]).toBeUndefined();
    expect(await extension.errors()).toEqual({});
  });

  it("rejects invalid semantics without saving any part, and can recover in the same editor", async () => {
    const { extension } = state;
    await extension.setProfiles([profile({ ruleActionType: "allow" })], 1);
    const before = await extension.manager();
    const popup = await extension.openExtensionPage("/import");
    const invalid = exchange({ requestHeaderModGroups: [{ type: "radio", items: [
      { enabled: true, name: "X-One", operation: "set", value: "one" },
      { enabled: true, name: "X-Two", operation: "set", value: "two" },
    ] }] });
    invalid.profiles.unshift(exchange().profiles[0]!);
    await setEditorText(popup, JSON.stringify(invalid));
    await expect.poll(() => popup.getByTestId("import-errors").textContent()).toContain("profiles.1.requestHeaderModGroups");
    expect(await popup.getByTestId("import-confirm").isDisabled()).toBe(true);
    expect(await extension.manager()).toEqual(before);
    expect(await extension.ruleCount()).toBe(1);
    await setEditorText(popup, JSON.stringify(exchange()));
    await expect.poll(() => popup.getByTestId("import-confirm").isEnabled()).toBe(true);
    await popup.getByTestId("import-confirm").click();
    await expect.poll(async () => (await extension.manager()).profiles).toHaveLength(2);
    expect((await extension.manager()).profiles[1]!.enabled).toBe(false);
  });

  it("resets activation consent when the input changes", async () => {
    const { extension } = state;
    await extension.setProfiles([profile({ enabled: false, ruleActionType: "allow" })], 0);
    const popup = await extension.openExtensionPage("/import");
    await setEditorText(popup, JSON.stringify(exchange()));
    await popup.getByTestId("import-keep-enabled").click();
    expect(await popup.getByTestId("import-keep-enabled").getAttribute("data-state")).toBe("checked");
    await setEditorText(popup, JSON.stringify(exchange({ name: "Changed import" })));
    await expect.poll(() => popup.getByTestId("import-keep-enabled").getAttribute("data-state")).toBe("unchecked");
    await popup.getByTestId("import-confirm").click();
    await expect.poll(async () => (await extension.manager()).profiles).toHaveLength(2);
    expect((await extension.manager()).profiles[1]!.enabled).toBe(false);
    expect(await extension.ruleCount()).toBe(0);
  });

  it("rejects oversized files before replacing the inspected input", async () => {
    const { extension } = state;
    await extension.setProfiles([profile({ ruleActionType: "allow" })], 1);
    const before = await extension.manager();
    const popup = await extension.openExtensionPage("/import");
    await popup.getByTestId("import-file-input").setInputFiles({
      buffer: Buffer.alloc(MAX_PROFILE_IMPORT_BYTES + 1, " "),
      mimeType: "application/json",
      name: "oversized.json",
    });
    await expect.poll(() => popup.getByText("Imports are limited to 1 MiB. Split this export into smaller files.", { exact: true }).isVisible()).toBe(true);
    expect(await popup.getByTestId("import-confirm").isDisabled()).toBe(true);
    expect(await extension.manager()).toEqual(before);
  });

  it("does not replace a newer draft when an earlier shared payload finishes decoding", async () => {
    const { extension } = state;
    await extension.setProfiles([profile({ enabled: false, ruleActionType: "allow" })], 0);
    const payload = gzipSync(Buffer.from(JSON.stringify(exchange({ name: "Late shared import" })))).toString("base64url");
    const popup = await extension.context.newPage();
    await popup.addInitScript(() => {
      const Original = DecompressionStream;
      const gate = new Promise<void>((resolve) => {
        window.releaseImportDecode = resolve;
      });
      class HeldDecompressionStream {
        writable;
        readable;
        constructor(format: CompressionFormat) {
          const stream = new Original(format);
          this.writable = stream.writable;
          this.readable = stream.readable.pipeThrough(new TransformStream({
            async transform(chunk, controller) {
              window.importDecodePending = true;
              await gate;
              controller.enqueue(chunk);
            },
            flush() {
              window.importDecodeFinished = true;
            },
          }));
        }
      }
      Object.defineProperty(window, "DecompressionStream", { value: HeldDecompressionStream });
    });
    await popup.goto(`chrome-extension://${extension.extensionId}/popup.html#/import?profiles=${payload}`);
    await expect.poll(() => popup.evaluate(() => window.importDecodePending)).toBe(true);
    await setEditorText(popup, JSON.stringify(exchange({ name: "Typed import" })));
    await popup.evaluate(() => window.releaseImportDecode());
    await popup.waitForFunction(() => window.importDecodeFinished);
    await popup.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await editorText(popup)).toContain("Typed import");
    expect(await editorText(popup)).not.toContain("Late shared import");
    await popup.getByTestId("import-confirm").click();
    await expect.poll(async () => (await extension.manager()).profiles).toHaveLength(2);
    expect((await extension.manager()).profiles[1]).toMatchObject({ name: "Typed import", enabled: false });
  });
});

declare global {
  interface Window {
    releaseImportDecode: () => void;
    importDecodePending?: boolean;
    importDecodeFinished?: boolean;
  }
}
