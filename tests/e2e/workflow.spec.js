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
    await expect(page.getByTestId("workflow-page").getByText("Support Workflow")).toBeVisible();
  });

  test("direct URL navigation works", async ({ page }) => {
    await visit(page, "/workflow");
    await expect(page.getByTestId("tab-workflow")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("workflow-page")).toBeVisible();
  });

  test("canvas is rendered", async ({ page }) => {
    await visit(page, "/workflow");
    const canvas = page.getByTestId("workflow-canvas");
    await expect(canvas).toBeVisible();
  });

  test("toolbar has add buttons for all node types", async ({ page }) => {
    await visit(page, "/workflow");

    await expect(page.getByTestId("workflow-add-start")).toBeVisible();
    await expect(page.getByTestId("workflow-add-end")).toBeVisible();
    await expect(page.getByTestId("workflow-add-action")).toBeVisible();
    await expect(page.getByTestId("workflow-add-decision")).toBeVisible();
    await expect(page.getByTestId("workflow-add-wait")).toBeVisible();
  });

  test("add node increases count", async ({ page }) => {
    await visit(page, "/workflow");

    // Initial: 10 nodes
    await expect(page.getByText("10 nodes")).toBeVisible();

    // Add a new action node
    await page.getByTestId("workflow-add-action").click();

    await expect(page.getByText("11 nodes")).toBeVisible();
  });

  test("reset restores default workflow", async ({ page }) => {
    await visit(page, "/workflow");

    // Add a node
    await page.getByTestId("workflow-add-action").click();
    await expect(page.getByText("11 nodes")).toBeVisible();

    // Reset
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

  test("takes a screenshot of the workflow page", async ({ page }) => {
    await visit(page, "/workflow");

    // Let canvas render
    await page.waitForTimeout(500);

    await page.screenshot({
      path: "screenshot-workflow.png",
      fullPage: true,
    });
  });

  test("takes a screenshot with animation running", async ({ page }) => {
    await visit(page, "/workflow");

    // Start animation
    await page.getByTestId("workflow-animate").click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "screenshot-workflow-animated.png",
      fullPage: true,
    });
  });
});
