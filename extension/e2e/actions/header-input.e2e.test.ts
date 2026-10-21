import { describe, expect, it } from "vitest";
import { setupExtensionSuite } from "../suite";
import { fetchEcho, group, header, profile } from "../test-util";

describe("header editor input", { concurrent: false }, () => {
  const state = setupExtensionSuite();

  it("previews pasted headers and inserts the entire valid list atomically", async () => {
    const { extension, server } = state;
    const headers = group([header("x-existing", "set", "original")]);
    await extension.setProfiles([profile({ requestHeaderModGroups: [headers] })], 1);
    const popup = await extension.openExtensionPage();
    await popup.getByTestId(`header-bulk-open-${headers.id}`).click();
    const input = popup.getByTestId("header-bulk-input");
    const confirm = popup.getByTestId("header-bulk-confirm");
    await input.fill("X-First: token:part\nbad name: invalid");
    expect(await confirm.isDisabled()).toBe(true);
    expect(await popup.getByTestId("header-bulk-errors").textContent()).toContain("Line 2");
    expect((await extension.manager()).profiles[0]?.requestHeaderModGroups?.[0]?.items).toHaveLength(1);

    await input.fill("X-First: token:part\r\nX-Location: https://localhost:3000/path\nX-Empty:");
    expect(await popup.getByTestId("header-bulk-preview").textContent()).toContain("https://localhost:3000/path");
    expect(await popup.getByTestId("header-bulk-empty-3").textContent()).toContain("no header operation");
    await confirm.click();
    await expect.poll(async () => (await extension.manager()).profiles[0]?.requestHeaderModGroups?.[0]?.items.map(entry => ({
      name: entry.name,
      value: entry.operation === "remove" ? undefined : entry.value,
    }))).toEqual([
      { name: "x-existing", value: "original" },
      { name: "X-First", value: "token:part" },
      { name: "X-Location", value: "https://localhost:3000/path" },
      { name: "X-Empty", value: "" },
    ]);

    const page = await extension.context.newPage();
    await page.goto(`${server.loopbackOrigin}/page`);
    await expect.poll(async () => (await fetchEcho(page, `${server.loopbackOrigin}/echo`)).headers["x-first"])
      .toBe("token:part");
    expect((await fetchEcho(page, `${server.loopbackOrigin}/echo`)).headers["x-location"])
      .toBe("https://localhost:3000/path");
    expect((await fetchEcho(page, `${server.loopbackOrigin}/echo`)).headers["x-empty"])
      .toBeUndefined();
  });

  it("keeps invalid name drafts local while the last saved header stays active", async () => {
    const { extension, server } = state;
    const entry = header("x-existing", "set", "original");
    await extension.setProfiles([profile({ requestHeaderModGroups: [group([entry])] })], 1);
    const popup = await extension.openExtensionPage();
    const nameInput = popup.getByTestId(`header-name-${entry.id}`);
    await nameInput.fill(" bad name ");
    expect(await nameInput.inputValue()).toBe(" bad name ");
    expect(await nameInput.getAttribute("aria-invalid")).toBe("true");
    expect(await popup.getByTestId(`header-name-error-${entry.id}`).isVisible()).toBe(true);
    await nameInput.blur();
    await popup.getByTestId(`header-value-${entry.id}`).fill(" updated ");
    await popup.getByTestId("profile-name").click();
    await popup.getByTestId("profile-name-input").fill("Draft persistence barrier");
    await popup.getByTestId("profile-name-save").click();
    await expect.poll(async () => (await extension.manager()).profiles[0]?.name).toBe("Draft persistence barrier");
    await expect.poll(async () => {
      const edited = (await extension.manager()).profiles[0]?.requestHeaderModGroups?.[0]?.items[0];
      return edited?.operation === "set" ? edited.value : undefined;
    }).toBe("original");
    await expect.poll(async () => (await extension.manager()).profiles[0]?.requestHeaderModGroups?.[0]?.items[0]?.name)
      .toBe("x-existing");
    expect(await popup.getByTestId(`header-name-error-${entry.id}`).textContent()).toContain("last saved");
    expect(await nameInput.inputValue()).toBe(" bad name ");
    const page = await extension.context.newPage();
    await page.goto(`${server.loopbackOrigin}/page`);
    await expect.poll(async () => (await fetchEcho(page, `${server.loopbackOrigin}/echo`)).headers["x-existing"])
      .toBe("original");
    expect(await extension.errors()).toEqual({});
    expect(await popup.evaluate(() => JSON.parse(localStorage.getItem("recent-request-header-names") ?? "[]")))
      .toEqual([]);

    await nameInput.fill("X-Valid");
    await nameInput.blur();
    await expect.poll(() => popup.evaluate(() => JSON.parse(localStorage.getItem("recent-request-header-names") ?? "[]")))
      .toEqual(["x-valid"]);
    expect(await nameInput.inputValue()).toBe("X-Valid");
    expect(await nameInput.getAttribute("aria-invalid")).toBe("false");
    await expect.poll(async () => (await fetchEcho(page, `${server.loopbackOrigin}/echo`)).headers["x-valid"])
      .toBe("updated");
  });

  it("keeps multiline value drafts local while the last saved header stays active", async () => {
    const { extension, server } = state;
    const entry = header("x-existing", "set", "original");
    await extension.setProfiles([profile({ requestHeaderModGroups: [group([entry])] })], 1);
    const popup = await extension.openExtensionPage();
    const valueInput = popup.getByTestId(`header-value-${entry.id}`);
    await valueInput.fill("one\ntwo");
    expect(await valueInput.inputValue()).toBe("one\ntwo");
    expect(await valueInput.getAttribute("aria-invalid")).toBe("true");
    expect(await popup.getByTestId(`header-value-error-${entry.id}`).textContent()).toContain("last saved");
    await popup.getByTestId(`header-name-${entry.id}`).fill("x-saved");
    await popup.getByTestId("profile-name").click();
    await popup.getByTestId("profile-name-input").fill("Draft persistence barrier");
    await popup.getByTestId("profile-name-save").click();
    await expect.poll(async () => (await extension.manager()).profiles[0]?.name).toBe("Draft persistence barrier");
    await expect.poll(async () => (await extension.manager()).profiles[0]?.requestHeaderModGroups?.[0]?.items[0]?.name)
      .toBe("x-existing");
    const saved = (await extension.manager()).profiles[0]?.requestHeaderModGroups?.[0]?.items[0];
    expect(saved?.operation === "set" ? saved.value : undefined).toBe("original");
    expect(await valueInput.inputValue()).toBe("one\ntwo");
    const page = await extension.context.newPage();
    await page.goto(`${server.loopbackOrigin}/page`);
    await expect.poll(async () => (await fetchEcho(page, `${server.loopbackOrigin}/echo`)).headers["x-existing"])
      .toBe("original");
    expect(await extension.errors()).toEqual({});
    await valueInput.fill(" corrected value ");
    await expect.poll(async () => {
      const edited = (await extension.manager()).profiles[0]?.requestHeaderModGroups?.[0]?.items[0];
      return edited?.operation === "set" ? edited.value : undefined;
    }).toBe(" corrected value ");
    await expect.poll(async () => (await fetchEcho(page, `${server.loopbackOrigin}/echo`)).headers["x-saved"])
      .toBe("corrected value");
  });

  it("switches a reloaded remove operation to set with a defined value", async () => {
    const { extension, server } = state;
    const entry = header("x-switched", "remove");
    await extension.setProfiles([profile({ requestHeaderModGroups: [group([entry])] })], 1);
    const popup = await extension.openExtensionPage();
    await popup.reload();
    const pageErrors: string[] = [];
    popup.on("pageerror", error => pageErrors.push(error.message));
    await popup.locator("button:has(.i-lucide-minus)").click();
    await expect.poll(async () => (await extension.manager()).profiles[0]?.requestHeaderModGroups?.[0]?.items[0])
      .toMatchObject({ operation: "set", value: "" });
    await popup.getByTestId(`header-value-${entry.id}`).fill("applied");
    const page = await extension.context.newPage();
    await page.goto(`${server.loopbackOrigin}/page`);
    await expect.poll(async () => (await fetchEcho(page, `${server.loopbackOrigin}/echo`)).headers["x-switched"])
      .toBe("applied");
    expect(pageErrors).toEqual([]);
  });

  it("shows imported CR/LF values as invalid and preserves corrected whitespace", async () => {
    const { extension } = state;
    const entry = header("x-existing", "set", "one\r\ntwo");
    await extension.setProfiles([profile({ requestHeaderModGroups: [group([entry])] })], 0);
    const popup = await extension.openExtensionPage();
    const valueInput = popup.getByTestId(`header-value-${entry.id}`);
    expect(await valueInput.getAttribute("aria-invalid")).toBe("true");
    expect(await popup.getByTestId(`header-value-error-${entry.id}`).isVisible()).toBe(true);
    await valueInput.fill(" corrected value ");
    await valueInput.blur();
    expect(await valueInput.getAttribute("aria-invalid")).toBe("false");
    await expect.poll(async () => {
      const edited = (await extension.manager()).profiles[0]?.requestHeaderModGroups?.[0]?.items[0];
      return edited?.operation === "set" ? edited.value : undefined;
    }).toBe(" corrected value ");
  });
});
