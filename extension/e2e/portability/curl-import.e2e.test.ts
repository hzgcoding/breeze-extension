import { uuidv7 } from "uuidv7";
import { describe, expect, it } from "vitest";
import { setupExtensionSuite } from "../suite";
import { fetchEcho, item, profile } from "../test-util";

describe("bash cURL import", { concurrent: false }, () => {
  const state = setupExtensionSuite();

  it("previews a scoped paused profile and only applies headers after activation", async () => {
    const { extension, server } = state;
    const groupId = uuidv7();
    const existing = profile({ name: "Existing environment", groupId, ruleActionType: "allow", filters: { requestDomains: { type: "checkbox", items: [item("existing.invalid")] } } });
    await extension.setProfiles([existing], 1, [{ id: groupId, name: "Environments", color: "#8ab4f8", type: "radio" }]);
    const page = await extension.openExtensionPage();
    await page.getByTestId("curl-import-open").click();
    await page.getByTestId("curl-import-input").fill(`curl '${server.localhostOrigin}/echo?secret=SOURCE-SECRET' -X POST -H 'X-Curl: abc:def' --data-raw '{"ignored":true}' --compressed`);
    await expect.poll(() => page.getByTestId("curl-import-preview").textContent()).toContain("localhost");
    await expect.poll(() => page.getByTestId("curl-import-preview").textContent()).toContain("POST");
    await expect.poll(() => page.getByTestId("curl-import-preview").textContent()).toContain("abc:def");
    expect(await page.getByTestId("curl-import-warnings").count()).toBe(1);
    await page.getByTestId("curl-import-confirm").click();
    await expect.poll(async () => (await extension.manager()).profiles).toHaveLength(2);
    const manager = await extension.manager();
    const imported = manager.profiles[1]!;
    expect(manager.profiles[0]).toEqual(existing);
    expect(manager.profileGroups[0]).toMatchObject({ id: groupId, type: "radio" });
    expect(imported).toMatchObject({
      enabled: false,
      filters: {
        requestDomains: { items: [{ enabled: true, value: "localhost" }] },
        requestMethods: { items: [{ enabled: true, value: ["post"] }] },
      },
    });
    expect(imported.groupId).toBeUndefined();
    expect(manager.selectedProfileId).toBe(imported.id);
    expect(JSON.stringify(imported)).not.toContain("SOURCE-SECRET");
    await expect.poll(() => extension.ruleCount()).toBe(1);
    const requestPage = await extension.context.newPage();
    await requestPage.goto(server.localhostOrigin);
    expect((await fetchEcho(requestPage, `${server.localhostOrigin}/echo`, { method: "POST" })).headers["x-curl"]).toBeUndefined();
    await page.getByTestId(`profile-${imported.id}`).click({ modifiers: ["Shift"] });
    await expect.poll(() => extension.ruleCount()).toBe(2);
    expect((await fetchEcho(requestPage, `${server.localhostOrigin}/echo`, { method: "POST" })).headers["x-curl"]).toBe("abc:def");
    expect((await fetchEcho(requestPage, `${server.localhostOrigin}/echo`)).headers["x-curl"]).toBeUndefined();
    expect((await fetchEcho(requestPage, `${server.loopbackOrigin}/echo`, { method: "POST" })).headers["x-curl"]).toBeUndefined();
    await page.close();
    await requestPage.close();
  });

  it("rejects unsafe commands atomically and clears pasted credentials on close", async () => {
    const { extension } = state;
    const existing = profile({ ruleActionType: "allow" });
    await extension.setProfiles([existing], 1);
    const page = await extension.openExtensionPage();
    await page.getByTestId("curl-import-open").click();
    await page.getByTestId("curl-import-input").fill("curl https://example.com -H 'Authorization: SECRET' ; echo unsafe");
    await expect.poll(() => page.getByTestId("curl-import-error").count()).toBe(1);
    expect(await page.getByTestId("curl-import-confirm").isDisabled()).toBe(true);
    expect(await page.getByTestId("curl-import-preview").count()).toBe(0);
    expect((await extension.manager()).profiles).toEqual([existing]);
    await page.keyboard.press("Escape");
    await page.getByTestId("curl-import-open").click();
    expect(await page.getByTestId("curl-import-input").inputValue()).toBe("");
    expect((await extension.manager()).profiles).toEqual([existing]);
    await page.close();
  });
});
