import type { Page } from "playwright";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { uuidv7 } from "uuidv7";
import { describe, expect, it } from "vitest";
import { setupExtensionSuite } from "../suite";
import { editorText, group, header, profile, setEditorText } from "../test-util";

function privateProfile() {
  return profile({
    enabled: false,
    name: "Private export",
    comments: "custom secrets still need review",
    requestHeaderModGroups: [group([
      header("aUtHoRiZaTiOn", "set", "Bearer private-source"),
      { ...header("X-Api-Key", "set", "disabled-source-key"), enabled: false },
      header("x-environment", "set", "staging"),
      header("Cookie", "remove"),
    ])],
    responseHeaderModGroups: [group([header("Set-Cookie", "append", "session=response-source")])],
    syncCookieGroups: [group([{
      id: uuidv7(),
      enabled: false,
      name: "session",
      domain: ".example.com",
      path: "/",
      value: "live-source-cookie",
    }])],
  });
}

async function interceptClipboard(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value: string) => window.e2eClipboard = value },
    });
  });
}

async function copy(page: Page, item: "export-copy-json" | "export-copy-link") {
  await page.evaluate(() => window.e2eClipboard = "");
  await page.getByTestId("export-menu-trigger").click();
  await page.getByTestId(item).click();
  await expect.poll(() => page.evaluate(() => window.e2eClipboard)).not.toBe("");
  return page.evaluate(() => window.e2eClipboard);
}

async function downloadJson(page: Page) {
  await page.getByTestId("export-menu-trigger").click();
  const downloading = page.waitForEvent("download");
  await page.getByTestId("export-download-json").click();
  return readFile(await (await downloading).path(), "utf8");
}

function shareJson(link: string) {
  const payload = new URLSearchParams(new URL(link).hash.slice(1)).get("profiles")!;
  return gunzipSync(Buffer.from(payload, "base64url")).toString("utf8");
}

describe("export privacy defaults and edited previews", { concurrent: false }, () => {
  const state = setupExtensionSuite();

  it("shows a redacted payload by default without changing stored profiles or group references", async () => {
    const target = privateProfile();
    await state.extension.context.addCookies([{ domain: ".example.com", name: "session", path: "/", value: "live-source-cookie" }]);
    const groupId = uuidv7();
    target.groupId = groupId;
    await state.extension.setProfiles([target], 0, [{ id: groupId, name: "Private group", color: "blue", type: "radio", lastEnabledProfileIds: [target.id] }]);
    const before = await state.extension.manager();
    const page = await state.extension.openExtensionPage(`/export/${target.id}`);
    await page.setViewportSize({ width: 1280, height: 4000 });
    await expect.poll(() => editorText(page)).toContain("Private export");
    const text = await editorText(page);
    expect(text).not.toContain("private-source");
    expect(text).not.toContain("disabled-source-key");
    expect(text).not.toContain("response-source");
    expect(text).not.toContain("live-source-cookie");
    expect(text).toContain("staging");
    expect(text).toContain("custom secrets still need review");
    expect(JSON.parse(text)).toMatchObject({
      profiles: [{ ref: "profile-1", groupRef: "group-1" }],
      profileGroups: [{ ref: "group-1", lastEnabledProfileRefs: ["profile-1"] }],
    });
    expect(await page.getByTestId("export-privacy-summary").textContent()).toContain("3");
    expect(await state.extension.manager()).toEqual(before);
    await page.close();
  });

  it("sanitizes edited JSON consistently across preview, clipboard, download and share link", async () => {
    const target = privateProfile();
    await state.extension.setProfiles([target], 0);
    const page = await state.extension.openExtensionPage(`/export/${target.id}`);
    await page.setViewportSize({ width: 1280, height: 4000 });
    await expect.poll(() => editorText(page)).toContain("Private export");
    await interceptClipboard(page);
    const edited = JSON.parse(await editorText(page));
    edited.profiles[0].name = "Edited safe export";
    edited.profiles[0].requestHeaderModGroups[0].items[0].value = "edited-credential";
    edited.profiles[0].syncCookieGroups[0].items[0].value = "edited-live-cookie";
    await setEditorText(page, JSON.stringify(edited));
    await expect.poll(() => editorText(page)).toContain("Edited safe export");
    await expect.poll(() => editorText(page)).not.toContain("edited-credential");
    const preview = JSON.parse(await editorText(page));
    expect(JSON.parse(await copy(page, "export-copy-json"))).toEqual(preview);
    expect(JSON.parse(await downloadJson(page))).toEqual(preview);
    expect(JSON.parse(shareJson(await copy(page, "export-copy-link")))).toEqual(preview);
    expect(JSON.stringify(preview)).not.toContain("edited-live-cookie");
    await page.close();
  });

  it("requires explicit inclusion, keeps synced cookies cleared and resets the choice on reload", async () => {
    const target = privateProfile();
    await state.extension.setProfiles([target], 0);
    const page = await state.extension.openExtensionPage(`/export/${target.id}`);
    await page.setViewportSize({ width: 1280, height: 4000 });
    await expect.poll(() => editorText(page)).toContain("Private export");
    await interceptClipboard(page);
    await page.getByTestId("export-retain-sensitive").click();
    await expect.poll(() => editorText(page)).toContain("Bearer private-source");
    const edited = JSON.parse(await editorText(page));
    edited.profiles[0].syncCookieGroups[0].items[0].value = "edited-cookie-in-optout";
    await setEditorText(page, JSON.stringify(edited));
    const json = await copy(page, "export-copy-json");
    expect(json).toContain("Bearer private-source");
    expect(json).not.toContain("edited-cookie-in-optout");
    await page.reload();
    await expect.poll(() => editorText(page)).toContain("Private export");
    expect(await editorText(page)).not.toContain("Bearer private-source");
    await page.close();
  });

  it("preserves manual credential removal and other edits when toggling inclusion", async () => {
    const target = privateProfile();
    await state.extension.setProfiles([target], 0);
    const page = await state.extension.openExtensionPage(`/export/${target.id}`);
    await page.setViewportSize({ width: 1280, height: 4000 });
    await expect.poll(() => editorText(page)).toContain("Private export");
    await page.getByTestId("export-retain-sensitive").click();
    const edited = JSON.parse(await editorText(page));
    edited.profiles[0].name = "Manual edit retained";
    edited.profiles[0].requestHeaderModGroups[0].items[0].value = "";
    await setEditorText(page, JSON.stringify(edited));
    await page.getByTestId("export-retain-sensitive").click();
    await page.getByTestId("export-retain-sensitive").click();
    expect(await editorText(page)).toContain("Manual edit retained");
    expect(await editorText(page)).not.toContain("Bearer private-source");
    await setEditorText(page, "invalid json containing secret");
    await expect.poll(() => page.getByTestId("export-menu-trigger").isDisabled()).toBe(true);
    await page.close();
  });

  it("locks inclusion during compression and discards a link after selection changes", async () => {
    const target = privateProfile();
    await state.extension.setProfiles([target], 0);
    const page = await state.extension.openExtensionPage(`/export/${target.id}`);
    await page.setViewportSize({ width: 1280, height: 4000 });
    await expect.poll(() => editorText(page)).toContain("Private export");
    await interceptClipboard(page);
    await page.evaluate(() => window.e2eClipboard = "");
    await page.getByTestId("export-retain-sensitive").click();
    await page.evaluate(() => {
      const original = Response.prototype.arrayBuffer;
      Response.prototype.arrayBuffer = async function () {
        const result = await original.call(this);
        document.body.dataset.exportPaused = "true";
        await new Promise<void>(resolve => window.addEventListener("release-export", () => resolve(), { once: true }));
        return result;
      };
    });
    await page.getByTestId("export-menu-trigger").click();
    await page.getByTestId("export-copy-link").click();
    await expect.poll(() => page.locator("body").getAttribute("data-export-paused")).toBe("true");
    expect(await page.getByTestId("export-retain-sensitive").isDisabled()).toBe(true);
    await page.locator("aside").getByRole("checkbox").first().click();
    await page.evaluate(() => window.dispatchEvent(new Event("release-export")));
    await expect.poll(() => page.getByTestId("export-retain-sensitive").isEnabled()).toBe(true);
    expect(await page.evaluate(() => window.e2eClipboard)).toBe("");
    await page.close();
  });

  it("reports export failures and restores the controls without exposing data", async () => {
    const target = privateProfile();
    await state.extension.setProfiles([target], 0);
    const page = await state.extension.openExtensionPage(`/export/${target.id}`);
    await expect.poll(() => editorText(page)).toContain("Private export");
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async () => {
          throw new Error("private platform error");
        } },
      });
    });
    await page.getByTestId("export-menu-trigger").click();
    await page.getByTestId("export-copy-json").click();
    await expect.poll(() => page.getByText("Export failed. Try again after checking the preview.", { exact: true }).isVisible()).toBe(true);
    expect(await page.getByTestId("export-menu-trigger").isEnabled()).toBe(true);
    expect(await page.getByText("private platform error").count()).toBe(0);
    await page.close();
  });

  it("discards a pending sensitive share when navigating away from export", async () => {
    const target = privateProfile();
    await state.extension.setProfiles([target], 0);
    const page = await state.extension.openExtensionPage(`/export/${target.id}`);
    await expect.poll(() => editorText(page)).toContain("Private export");
    await interceptClipboard(page);
    await page.evaluate(() => window.e2eClipboard = "");
    await page.getByTestId("export-retain-sensitive").click();
    await page.evaluate(() => {
      const original = Response.prototype.arrayBuffer;
      Response.prototype.arrayBuffer = async function () {
        const result = await original.call(this);
        document.body.dataset.exportPaused = "true";
        await new Promise<void>(resolve => window.addEventListener("release-export", () => resolve(), { once: true }));
        return result;
      };
    });
    await page.getByTestId("export-menu-trigger").click();
    await page.getByTestId("export-copy-link").click();
    await expect.poll(() => page.locator("body").getAttribute("data-export-paused")).toBe("true");
    await page.evaluate(() => location.hash = "#/profiles");
    await expect.poll(() => page.getByTestId("export-privacy").count()).toBe(0);
    await page.evaluate(() => window.dispatchEvent(new Event("release-export")));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await page.evaluate(() => window.e2eClipboard)).toBe("");
    await page.close();
  });
});
