import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { uuidv7 } from "uuidv7";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SHARE_PAGE_URL } from "../../src/lib/product";
import { setupExtensionSuite } from "../suite";
import {
  editorText,
  group,
  header,
  item,
  profile,
  setEditorText,
} from "../test-util";

function portableProfile() {
  return profile({
    comments: "comments remain visible",
    groupId: uuidv7(),
    filters: {
      requestDomains: group([item("example.com")]),
    },
    name: "Portable profile",
    requestHeaderModGroups: [group([header("authorization", "set", "Bearer preserved")])],
    syncCookieGroups: [group([{
      domain: ".example.com",
      enabled: true,
      id: uuidv7(),
      name: "session",
      path: "/admin",
      value: "must-not-export",
    }])],
  });
}

async function exportedJson(page: Parameters<typeof editorText>[0]) {
  await expect.poll(() => editorText(page)).toContain("Portable profile");
  await page.getByTestId("export-menu-trigger").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-download-json").click();
  const download = await downloadPromise;
  return z.object({
    profiles: z.array(z.record(z.string(), z.unknown())),
    profileGroups: z.array(z.record(z.string(), z.unknown())),
    version: z.number(),
  }).parse(JSON.parse(await readFile(await download.path(), "utf8")));
}

describe("documented import, export, download, and share behavior", { concurrent: false }, () => {
  const state = setupExtensionSuite();

  it("exports group membership with local references and removes IDs and temporary tab conditions", async () => {
    const { extension } = state;
    const target = portableProfile();
    const page = await extension.context.newPage();
    await page.goto(`${state.server.loopbackOrigin}/page?export=scope`);
    const tabId = await extension.tabId(page);
    const tabGroupId = await extension.worker.evaluate(async id => await browser.tabs.group({ tabIds: [id] }), tabId);
    target.filters.tabGroups = group([item([{ groupId: tabGroupId, tabIds: [tabId] }])]);
    target.filters.tabIds = group([item([tabId])]);
    target.filters.excludedTabIds = group([item([-1])]);
    target.filters.excludedTabGroups = group([{ ...item([{ groupId: tabGroupId, tabIds: [tabId] }]), enabled: false }]);
    const groupId = target.groupId!;
    await extension.setProfiles([target], 1, [{
      color: "#8ab4f8",
      id: groupId,
      name: "Portable group",
      type: "checkbox",
    }]);
    const exportPage = await extension.openExtensionPage(`/export/${target.id}`);
    const exported = await exportedJson(exportPage);
    const serialized = JSON.stringify(exported);

    expect(exported.version).toBe(2);
    expect(serialized).not.toContain("\"id\"");
    expect(serialized).not.toContain("groupId");
    expect(serialized).not.toContain("tabIds");
    expect(serialized).not.toContain("tabGroups");
    expect(serialized).not.toContain("excludedTabIds");
    expect(serialized).not.toContain("excludedTabGroups");
    expect((await extension.manager()).profiles[0]?.filters.tabIds?.items[0]?.value).toEqual([tabId]);
    expect(serialized).not.toContain(groupId);
    expect(exported.profiles[0]!.groupRef).toBe("group-1");
    expect(exported.profileGroups).toEqual([{ ref: "group-1", color: "#8ab4f8", name: "Portable group", type: "checkbox" }]);
    await exportPage.close();
  });

  it("redacts recognized credentials while retaining cookie identity and comments", async () => {
    const { extension } = state;
    const target = portableProfile();
    await extension.context.addCookies([{
      domain: ".example.com",
      name: "session",
      path: "/admin",
      value: "must-not-export",
    }]);
    await extension.setProfiles([target], 1);
    await expect.poll(async () => (await extension.manager()).profiles[0]?.syncCookieGroups?.[0]?.items[0]?.value)
      .toBe("must-not-export");
    const exportPage = await extension.openExtensionPage(`/export/${target.id}`);
    const exported = await exportedJson(exportPage);
    const serialized = JSON.stringify(exported);

    expect(serialized).not.toContain("must-not-export");
    expect(serialized).toContain(".example.com");
    expect(serialized).toContain("/admin");
    expect(serialized).toContain("session");
    expect(serialized).not.toContain("Bearer preserved");
    expect(serialized).toContain("comments remain visible");
    expect((await extension.manager()).profiles[0]?.syncCookieGroups?.[0]?.items[0]?.value).toBe("must-not-export");
    await exportPage.close();
  });

  it("preserves redirect destinations in exported profiles", async () => {
    const { extension } = state;
    const redirect = profile({
      name: "Portable redirect",
      redirectUrlGroup: [item("https://private.example.test/destination?token=visible")],
      ruleActionType: "redirect",
    });
    await extension.setProfiles([redirect], 1);
    const exportPage = await extension.openExtensionPage(`/export/${redirect.id}`);
    await expect.poll(() => editorText(exportPage)).toContain("Portable redirect");
    expect(await editorText(exportPage)).toContain("https://private.example.test/destination?token=visible");
    await exportPage.close();
  });

  it("copies JSON and downloads the same profile exchange", async () => {
    const { extension } = state;
    const target = portableProfile();
    await extension.setProfiles([target], 1);
    const exportPage = await extension.openExtensionPage(`/export/${target.id}`);
    const exported = await exportedJson(exportPage);
    await exportPage.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async (value: string) => window.e2eClipboard = value },
      });
    });

    await exportPage.getByTestId("export-menu-trigger").click();
    await exportPage.getByTestId("export-copy-json").click();
    await expect.poll(() => exportPage.evaluate(() => window.e2eClipboard)).toContain("Portable profile");
    expect(JSON.parse(await exportPage.evaluate(() => window.e2eClipboard))).toEqual(exported);

    await exportPage.reload();
    await expect.poll(() => editorText(exportPage)).toContain("Portable profile");
    await exportPage.getByTestId("export-menu-trigger").click();
    const downloadPromise = exportPage.waitForEvent("download");
    await exportPage.getByTestId("export-download-json").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("breeze-profiles.json");
    expect(JSON.parse(await readFile(await download.path(), "utf8"))).toEqual(exported);
    await exportPage.close();
  });

  it("opens private fragment share links without sending profiles to the hosting server", async () => {
    const { extension } = state;
    const target = portableProfile();
    await extension.setProfiles([target], 1);
    const exportPage = await extension.openExtensionPage(`/export/${target.id}`);
    const exported = await exportedJson(exportPage);
    await exportPage.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async (value: string) => window.e2eClipboard = value },
      });
    });
    await exportPage.getByTestId("export-menu-trigger").click();
    await exportPage.getByTestId("export-copy-link").click();
    await expect.poll(() => exportPage.evaluate(() => window.e2eClipboard))
      .toContain(`${SHARE_PAGE_URL}#profiles=`);
    const shareLink = await exportPage.evaluate(() => window.e2eClipboard);
    expect(new URL(shareLink).search).toBe("");
    await exportPage.close();

    let requestedUrl = "";
    await extension.context.route(SHARE_PAGE_URL, async (route) => {
      requestedUrl = route.request().url();
      await route.fulfill({ body: "<!doctype html><title>Shared profiles</title>", contentType: "text/html" });
    });
    const sharePage = await extension.context.newPage();
    await sharePage.goto(shareLink);
    await expect.poll(() => sharePage.url())
      .toContain(`chrome-extension://${extension.extensionId}/popup.html#/import`);
    expect(requestedUrl).toBe(SHARE_PAGE_URL);
    await expect.poll(async () => JSON.parse(await editorText(sharePage))).toEqual(exported);
    await sharePage.getByTestId("import-confirm").click();
    await expect.poll(async () => (await extension.manager()).profiles).toHaveLength(2);
    expect((await extension.manager()).profiles[1]?.enabled).toBe(false);
    await sharePage.close();
  });

  it("imports pasted JSON with fresh IDs without overwriting same-name profiles", async () => {
    const { extension } = state;
    const existing = portableProfile();
    await extension.setProfiles([existing], 1);
    const exportPage = await extension.openExtensionPage(`/export/${existing.id}`);
    const exported = await exportedJson(exportPage);
    await exportPage.close();

    const importPage = await extension.openExtensionPage("/import");
    await setEditorText(importPage, JSON.stringify(exported));
    await importPage.getByTestId("import-confirm").click();
    await expect.poll(async () => (await extension.manager()).profiles).toHaveLength(2);
    const profiles = (await extension.manager()).profiles;
    expect(profiles.map(entry => entry.name)).toEqual(["Portable profile", "Portable profile"]);
    expect(profiles[1]?.id).not.toBe(existing.id);
    expect(profiles[1]?.requestHeaderModGroups?.[0]?.id).not.toBe(existing.requestHeaderModGroups?.[0]?.id);
    expect(profiles[1]?.syncCookieGroups?.[0]?.items[0]?.value).toBe("");
  });

  it("loads profile JSON from a file before confirmation", async () => {
    const { extension } = state;
    const target = portableProfile();
    await extension.setProfiles([target], 1);
    const exportPage = await extension.openExtensionPage(`/export/${target.id}`);
    const exported = await exportedJson(exportPage);
    await exportPage.close();
    exported.profiles[0]!.name = "Imported from file";

    const importPage = await extension.openExtensionPage("/import");
    await importPage.getByTestId("import-file-input").setInputFiles({
      buffer: Buffer.from(JSON.stringify(exported)),
      mimeType: "application/json",
      name: "breeze-profiles.json",
    });
    await expect.poll(() => editorText(importPage)).toContain("Imported from file");
    await expect.poll(() => importPage.getByTestId("import-confirm").isEnabled()).toBe(true);
    await importPage.getByTestId("import-confirm").click();
    await expect.poll(async () => (await extension.manager()).profiles.some(entry => entry.name === "Imported from file"))
      .toBe(true);
  });

  it("keeps confirmation disabled for malformed JSON or the wrong exchange schema", async () => {
    const { extension } = state;
    await extension.setProfiles([], 0);
    const importPage = await extension.openExtensionPage("/import");
    await setEditorText(importPage, "not-json");
    await expect.poll(() => importPage.getByTestId("import-confirm").isDisabled()).toBe(true);
    await expect.poll(() => importPage.getByTestId("import-beautify").isDisabled()).toBe(true);

    await setEditorText(importPage, JSON.stringify({ profiles: [], version: 999 }));
    await expect.poll(() => importPage.getByTestId("import-beautify").isEnabled()).toBe(true);
    await expect.poll(() => importPage.getByTestId("import-confirm").isDisabled()).toBe(true);
    await importPage.close();
  });

  it("cancels a valid import without changing stored profiles", async () => {
    const { extension } = state;
    const existing = profile({ ruleActionType: "allow" });
    await extension.setProfiles([existing], 1);
    const before = await extension.manager();
    const popup = await extension.openExtensionPage("/import");
    await setEditorText(popup, JSON.stringify({ version: 1, profiles: [{ name: "Cancelled", emoji: "🧪", enabled: true, ruleActionType: "block", filters: {} }] }));
    await expect.poll(() => popup.getByTestId("import-confirm").isEnabled()).toBe(true);
    await popup.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect.poll(() => new URL(popup.url()).hash).toBe("#/");
    await expect.poll(() => popup.getByTestId(`profile-${existing.id}`).isVisible()).toBe(true);
    expect(await extension.manager()).toEqual(before);
    expect(await extension.ruleCount()).toBe(1);
  });

  it("rejects a corrupted share payload without changing saved profiles", async () => {
    const { extension } = state;
    await extension.setProfiles([profile({ ruleActionType: "allow" })], 1);
    const before = await extension.manager();
    const popup = await extension.openExtensionPage("/import?profiles=not-a-compressed-payload");
    await expect.poll(() => popup.getByText("Import failed: Invalid share link", { exact: true }).isVisible()).toBe(true);
    await expect.poll(() => popup.getByTestId("import-confirm").isDisabled()).toBe(true);
    expect(await editorText(popup)).toBe("");
    expect(await extension.manager()).toEqual(before);
  });
});

declare global {
  interface Window {
    e2eClipboard: string;
  }
}
