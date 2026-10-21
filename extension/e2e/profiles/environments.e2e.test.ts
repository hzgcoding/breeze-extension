import { uuidv7 } from "uuidv7";
import { describe, expect, it } from "vitest";
import { setupExtensionSuite } from "../suite";
import { fetchEcho, group, header, profile } from "../test-util";

describe("visible environment switching", { concurrent: false }, () => {
  const state = setupExtensionSuite();

  it("switches the headers sent by real requests and pauses the entire group", async () => {
    const { extension, server } = state;
    const groupId = uuidv7();
    const boe = profile({ groupId, name: "BOE", requestHeaderModGroups: [group([header("x-env", "set", "boe")])] });
    const ppe = profile({ groupId, name: "PPE", enabled: false, requestHeaderModGroups: [group([header("x-env", "set", "ppe")])] });
    await extension.setProfiles([boe, ppe], 1, [{ id: groupId, name: "Environments", color: "#8ab4f8", type: "radio" }]);
    const popup = await extension.openExtensionPage();
    const page = await extension.context.newPage();
    await page.goto(`${server.loopbackOrigin}/page`);
    expect((await fetchEcho(page, `${server.loopbackOrigin}/echo`)).headers["x-env"]).toBe("boe");

    await popup.getByTestId(`environment-select-${groupId}`).selectOption(ppe.id);
    await expect.poll(async () => (await fetchEcho(page, `${server.loopbackOrigin}/echo`)).headers["x-env"]).toBe("ppe");
    expect((await extension.manager()).profiles.map(entry => entry.enabled)).toEqual([false, true]);

    await popup.getByTestId(`environment-select-${groupId}`).selectOption("");
    await expect.poll(async () => (await fetchEcho(page, `${server.loopbackOrigin}/echo`)).headers["x-env"]).toBeUndefined();
  });

  it("creates an environment group from existing profiles without a context menu", async () => {
    const { extension } = state;
    const boe = profile({ name: "BOE", ruleActionType: "allow" });
    const ppe = profile({ name: "PPE", enabled: false, ruleActionType: "allow" });
    await extension.setProfiles([boe, ppe], 1);
    const popup = await extension.openExtensionPage();
    await popup.getByTestId("environment-create").click();
    await popup.getByTestId("environment-name").fill("Release");
    await popup.getByTestId(`environment-member-${ppe.id}`).check();
    await popup.getByTestId("environment-save").click();
    await expect.poll(async () => (await extension.manager()).profileGroups).toMatchObject([{ name: "Release", type: "radio" }]);
    const manager = await extension.manager();
    expect(manager.profiles.map(entry => entry.groupId)).toEqual([manager.profileGroups[0]?.id, manager.profileGroups[0]?.id]);
  });
});
