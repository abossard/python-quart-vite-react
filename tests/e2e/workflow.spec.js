import { expect, test } from "@playwright/test";

const APP_URL = process.env.E2E_APP_URL || "http://localhost:3001";

async function visit(page, path = "/") {
  const url = path === "/" ? APP_URL : `${APP_URL}${path}`;
  await page.goto(url, { waitUntil: "load" });
  await expect(page.getByText("CSV Ticket Viewer")).toBeVisible();
}

test.describe("Workflow page", () => {
  test("tab exists and navigates to workflow page", async ({ page }) => {
    await visit(page);
    const tab = page.getByTestId("tab-workflow");
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("workflow-page")).toBeVisible();
  });

  test("direct URL navigation works", async ({ page }) => {
    await visit(page, "/workflow");
    await expect(page.getByTestId("tab-workflow")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("workflow-page")).toBeVisible();
  });

  test("canvas is rendered with incident workflow by default", async ({ page }) => {
    await visit(page, "/workflow");
    await expect(page.getByTestId("workflow-canvas")).toBeVisible();
    await expect(page.getByText("10 nodes")).toBeVisible();
  });

  test("switch to Problem Solving workflow", async ({ page }) => {
    await visit(page, "/workflow");
    await page.getByTestId("workflow-preset-problem").click();
    await expect(page.getByText("9 nodes")).toBeVisible();
  });

  test("switch to Change Management workflow", async ({ page }) => {
    await visit(page, "/workflow");
    await page.getByTestId("workflow-preset-change").click();
    await expect(page.getByText("8 nodes")).toBeVisible();
  });

  test("add node increases count", async ({ page }) => {
    await visit(page, "/workflow");
    await expect(page.getByText("10 nodes")).toBeVisible();
    await page.getByTestId("workflow-add-node").click();
    await page.getByText("Done").click();
    await expect(page.getByText("11 nodes")).toBeVisible();
  });

  test("reset restores default workflow", async ({ page }) => {
    await visit(page, "/workflow");
    await page.getByTestId("workflow-add-node").click();
    // Close dialog that opens for the new node
    await page.getByText("Done").click();
    await expect(page.getByText("11 nodes")).toBeVisible();
    await page.getByTestId("workflow-reset").click();
    await expect(page.getByText("10 nodes")).toBeVisible();
  });

  test("animate button toggles", async ({ page }) => {
    await visit(page, "/workflow");
    const btn = page.getByTestId("workflow-animate");
    await expect(btn).toContainText("Animate");
    await btn.click();
    await expect(btn).toContainText("Stop");
    await btn.click();
    await expect(btn).toContainText("Animate");
  });

  test("clicking canvas node opens config dialog", async ({ page }) => {
    await visit(page, "/workflow");
    // Click roughly where the first node is (80, 160)
    const canvas = page.getByTestId("workflow-canvas");
    const box = await canvas.boundingBox();
    await canvas.click({ position: { x: 80, y: 160 } });

    // Dialog should open
    await expect(page.getByTestId("workflow-agent-select")).toBeVisible({ timeout: 3000 });
    // Color picker should be visible
    await expect(page.getByTestId("color-red")).toBeVisible();
  });

  test("legend shows used colors", async ({ page }) => {
    await visit(page, "/workflow");
    // Incident workflow uses Red, Orange, Green, Blue
    await expect(page.getByText("Red")).toBeVisible();
    await expect(page.getByText("Green")).toBeVisible();
    await expect(page.getByText("Blue")).toBeVisible();
  });

  test("takes a screenshot of the incident workflow", async ({ page }) => {
    await visit(page, "/workflow");
    await page.waitForTimeout(500);
    await page.screenshot({ path: "screenshot-workflow.png", fullPage: true });
  });

  test("takes a screenshot with animation running", async ({ page }) => {
    await visit(page, "/workflow");
    await page.getByTestId("workflow-animate").click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "screenshot-workflow-animated.png", fullPage: true });
  });
});
