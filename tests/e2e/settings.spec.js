import { expect, test } from "@playwright/test";
import { APP_URL, visit } from "./helpers.js";

test.describe("Settings page", () => {
  // Clear localStorage before each test for isolation
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: "load" });
    await page.evaluate(() => localStorage.removeItem("tabPreferences"));
  });

  test("tab exists and navigates to settings page", async ({ page }) => {
    await visit(page);

    const settingsTab = page.getByTestId("tab-settings");
    await expect(settingsTab).toBeVisible();

    await settingsTab.click();
    await expect(settingsTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("settings-page")).toBeVisible();
    await expect(page.getByText("Menu Settings")).toBeVisible();
  });

  test("direct URL navigation works", async ({ page }) => {
    await visit(page, "/settings");

    await expect(page.getByTestId("tab-settings")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("settings-page")).toBeVisible();
  });

  test("lists all tabs with visibility toggles", async ({ page }) => {
    await visit(page, "/settings");

    // Core static tabs should all appear
    await expect(page.getByTestId("settings-tab-csvtickets")).toBeVisible();
    await expect(page.getByTestId("settings-tab-kitchensink")).toBeVisible();
    await expect(page.getByTestId("settings-tab-fields")).toBeVisible();
    await expect(page.getByTestId("settings-tab-workbench")).toBeVisible();
    await expect(page.getByTestId("settings-tab-agent")).toBeVisible();
    await expect(page.getByTestId("settings-tab-activity")).toBeVisible();

    // Settings tab itself should NOT appear in the settings list (it's always pinned)
    await expect(page.getByTestId("settings-tab-settings")).not.toBeVisible();

    // Each row has a toggle switch
    const toggles = page.locator('[data-testid^="toggle-"]');
    const count = await toggles.count();
    expect(count).toBeGreaterThanOrEqual(8);
  });

  test("toggle hides a tab from the nav bar", async ({ page }) => {
    await visit(page, "/settings");

    // Kitchen Sink tab should be visible in nav
    await expect(page.getByTestId("tab-kitchensink")).toBeVisible();

    // Toggle it off
    await page.getByTestId("toggle-kitchensink").click();

    // Tab should disappear from nav
    await expect(page.getByTestId("tab-kitchensink")).not.toBeVisible();

    // The settings row should show "Hidden" label
    const row = page.getByTestId("settings-tab-kitchensink");
    await expect(row).toBeVisible(); // still in settings list
  });

  test("toggle restores a hidden tab", async ({ page }) => {
    await visit(page, "/settings");

    // Hide it
    await page.getByTestId("toggle-kitchensink").click();
    await expect(page.getByTestId("tab-kitchensink")).not.toBeVisible();

    // Show it again
    await page.getByTestId("toggle-kitchensink").click();
    await expect(page.getByTestId("tab-kitchensink")).toBeVisible();
  });

  test("hidden tabs persist across page reload", async ({ page }) => {
    await visit(page, "/settings");

    // Hide Fields tab
    await page.getByTestId("toggle-fields").click();
    await expect(page.getByTestId("tab-fields")).not.toBeVisible();

    // Reload
    await page.reload({ waitUntil: "load" });
    await expect(page.getByText("CSV Ticket Viewer")).toBeVisible();

    // Fields tab should still be hidden
    await expect(page.getByTestId("tab-fields")).not.toBeVisible();
  });

  test("reset button restores all defaults", async ({ page }) => {
    await visit(page, "/settings");

    // Hide two tabs
    await page.getByTestId("toggle-fields").click();
    await page.getByTestId("toggle-kitchensink").click();
    await expect(page.getByTestId("tab-fields")).not.toBeVisible();
    await expect(page.getByTestId("tab-kitchensink")).not.toBeVisible();

    // Reset
    await page.getByTestId("settings-reset").click();

    // Both tabs should be back
    await expect(page.getByTestId("tab-fields")).toBeVisible();
    await expect(page.getByTestId("tab-kitchensink")).toBeVisible();
  });

  test("icon picker opens and allows icon selection", async ({ page }) => {
    await visit(page, "/settings");

    // Click the first icon picker trigger
    const firstPicker = page
      .getByTestId("settings-tab-csvtickets")
      .getByTestId("icon-picker-trigger");
    await firstPicker.click();

    // Icon grid should appear
    await expect(page.getByTestId("icon-grid")).toBeVisible();

    // Select a different icon (e.g., Rocket)
    await page.getByTestId("icon-option-Rocket24Regular").click();

    // Grid should close
    await expect(page.getByTestId("icon-grid")).not.toBeVisible();
  });

  test("drag handles are present on all rows", async ({ page }) => {
    await visit(page, "/settings");

    const handles = page.getByTestId("drag-handle");
    const count = await handles.count();
    expect(count).toBeGreaterThanOrEqual(8);
  });

  test("takes a screenshot of the settings page", async ({ page }) => {
    await visit(page, "/settings");

    // Hide one tab for visual variety
    await page.getByTestId("toggle-kitchensink").click();

    // Wait for the UI to settle
    await page.waitForTimeout(300);

    await page.screenshot({
      path: "screenshot-settings.png",
      fullPage: true,
    });
  });

  test("takes a screenshot with icon picker open", async ({ page }) => {
    await visit(page, "/settings");

    // Open icon picker on a row
    const picker = page
      .getByTestId("settings-tab-csvtickets")
      .getByTestId("icon-picker-trigger");
    await picker.click();
    await expect(page.getByTestId("icon-grid")).toBeVisible();

    await page.screenshot({
      path: "screenshot-settings-iconpicker.png",
      fullPage: true,
    });
  });
});
