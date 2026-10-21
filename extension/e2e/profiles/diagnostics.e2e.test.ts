import { describe, expect, it } from "vitest";
import { setupExtensionSuite } from "../suite";
import { group, header, item, profile } from "../test-util";

describe("profile diagnostics", { concurrent: false }, () => {
  const state = setupExtensionSuite();

  it("shows missing operations even in an empty profile", async () => {
    await state.extension.setProfiles([profile({})], 0);
    const popup = await state.extension.openExtensionPage();
    await expect.poll(() => popup.getByTestId("profile-diagnostics-status").textContent()).toContain("No active operations");
    await popup.close();
  });

  it("checks request domains locally and names potentially conflicting profiles", async () => {
    const selected = profile({
      name: "Development",
      filters: {
        requestDomains: group([item("example.test")]),
        excludedRequestDomains: group([item("private.example.test")]),
      },
      requestHeaderModGroups: [group([header("x-environment", "set", "development-secret")])],
    });
    const other = profile({
      name: "Staging",
      filters: { requestDomains: group([item("api.example.test")]) },
      requestHeaderModGroups: [group([header("X-Environment", "remove")])],
    });
    await state.extension.setProfiles([selected, other], 2);
    const popup = await state.extension.openExtensionPage();
    await expect.poll(() => popup.getByTestId("profile-diagnostics-status").textContent()).toContain("Registered");
    expect(await popup.getByTestId("profile-diagnostics").textContent()).toContain("not an observed network request");
    expect(await popup.getByTestId("profile-diagnostics-conflicts").textContent()).toContain("Staging");
    expect(await popup.getByTestId("profile-diagnostics-conflicts").textContent()).not.toContain("development-secret");

    await popup.getByTestId("profile-diagnostics-toggle").click();
    await popup.getByTestId("profile-diagnostics-url").fill("https://private.example.test/request");
    await expect.poll(() => popup.getByTestId("profile-diagnostics-result").textContent()).toContain("Excluded request domain");
    await popup.getByTestId("profile-diagnostics-url").fill("https://api.example.test/request");
    await expect.poll(() => popup.getByTestId("profile-diagnostics-result").textContent()).toContain("Request domain passes");
    await popup.close();
  });
});
