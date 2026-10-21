import { uuidv7 } from "uuidv7";
import { describe, expect, it } from "vitest";
import { SHARE_PAGE_URL } from "../../src/lib/product";
import { profileExchangeZodSchema } from "../../src/lib/schema";
import { setupExtensionSuite } from "../suite";
import { editorText, profile, setEditorText } from "../test-util";

describe("profile group portability", { concurrent: false }, () => {
  const state = setupExtensionSuite();

  it("appends grouped imports with fresh IDs, remembered membership and radio behavior", async () => {
    const { extension } = state;
    const existingGroupId = uuidv7();
    const existing = profile({ groupId: existingGroupId, name: "Existing", ruleActionType: "allow" });
    await extension.setProfiles([existing], 1, [{ id: existingGroupId, name: "Environments", color: "#8ab4f8", type: "checkbox" }]);
    const popup = await extension.openExtensionPage("/import");
    await setEditorText(popup, JSON.stringify({
      version: 2,
      profiles: [
        { ref: "dev", groupRef: "env", name: "Development", emoji: "D", enabled: false, ruleActionType: "allow", filters: {} },
        { ref: "staging", groupRef: "env", name: "Staging", emoji: "S", enabled: false, ruleActionType: "allow", filters: {} },
      ],
      profileGroups: [{ ref: "env", name: "Environments", color: "#f28b82", type: "radio", lastEnabledProfileRefs: ["staging"] }],
    }));
    await popup.getByTestId("import-confirm").click();
    await expect.poll(async () => (await extension.manager()).profiles).toHaveLength(3);
    const manager = await extension.manager();
    expect(manager.profileGroups).toHaveLength(2);
    expect(manager.profileGroups[0]!.id).toBe(existingGroupId);
    const importedGroup = manager.profileGroups[1]!;
    const development = manager.profiles[1]!;
    const staging = manager.profiles[2]!;
    expect(importedGroup).toMatchObject({ name: "Environments", color: "#f28b82", type: "radio", lastEnabledProfileIds: [staging.id] });
    expect(importedGroup.id).not.toBe(existingGroupId);
    expect(development.groupId).toBe(importedGroup.id);
    expect(staging.groupId).toBe(importedGroup.id);
    expect(development.id).not.toBe("dev");
    expect(staging.id).not.toBe("staging");

    await popup.getByTestId(`profile-${development.id}`).click({ modifiers: ["Shift"] });
    await popup.getByTestId(`profile-${staging.id}`).click({ modifiers: ["Shift"] });
    await expect.poll(async () => (await extension.manager()).profiles.map(entry => entry.enabled)).toEqual([true, false, true]);
    expect((await extension.manager()).profileGroups[1]!.lastEnabledProfileIds).toBeUndefined();
    await expect.poll(() => extension.ruleCount()).toBe(2);
    await popup.close();
  });

  it("round trips a partial radio group through a compressed share link", async () => {
    const { extension } = state;
    const groupId = uuidv7();
    const development = profile({ groupId, name: "Shared development", enabled: false, ruleActionType: "allow" });
    const staging = profile({ groupId, name: "Not selected", enabled: false, ruleActionType: "allow" });
    await extension.setProfiles([development, staging], 0, [{
      id: groupId,
      name: "Shared environments",
      color: "#8ab4f8",
      type: "radio",
      lastEnabledProfileIds: [development.id],
    }]);
    const exportPage = await extension.openExtensionPage(`/export/${development.id}`);
    await expect.poll(() => editorText(exportPage)).toContain("Shared development");
    const exchange = profileExchangeZodSchema.parse(JSON.parse(await editorText(exportPage)));
    expect(exchange.version).toBe(2);
    expect(exchange.profiles).toHaveLength(1);
    expect(exchange).toMatchObject({
      profiles: [{ ref: "profile-1", groupRef: "group-1" }],
      profileGroups: [{ ref: "group-1", name: "Shared environments", color: "#8ab4f8", type: "radio", lastEnabledProfileRefs: ["profile-1"] }],
    });
    await exportPage.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async (value: string) => window.e2eClipboard = value },
      });
    });
    await exportPage.getByTestId("export-menu-trigger").click();
    await exportPage.getByTestId("export-copy-link").click();
    await expect.poll(() => exportPage.evaluate(() => window.e2eClipboard)).toContain(`${SHARE_PAGE_URL}#profiles=`);
    const link = await exportPage.evaluate(() => window.e2eClipboard);
    await exportPage.close();
    await extension.context.route("https://hzgcoding.github.io/breeze-extension/share*", async route => route.fulfill({
      body: "<!doctype html><title>Breeze share</title>",
      contentType: "text/html",
    }));
    const sharePage = await extension.context.newPage();
    await sharePage.goto(link.replace("/share.html#", "/share#"));
    await expect.poll(() => sharePage.url()).toContain(`chrome-extension://${extension.extensionId}/popup.html#/import`);
    await expect.poll(async () => JSON.parse(await editorText(sharePage))).toEqual(exchange);
    await sharePage.getByTestId("import-confirm").click();
    await expect.poll(async () => (await extension.manager()).profiles).toHaveLength(3);
    const manager = await extension.manager();
    const imported = manager.profiles[2]!;
    expect(imported.groupId).not.toBe(groupId);
    expect(manager.profileGroups[1]).toEqual({
      id: imported.groupId,
      name: "Shared environments",
      color: "#8ab4f8",
      type: "radio",
      lastEnabledProfileIds: [imported.id],
    });
    await sharePage.close();
  });
});
