import { expect, test } from "@playwright/test";
import { APP_URL } from "./helpers.js";

async function goToCreateTab(page) {
  await page.goto(`${APP_URL}/workbench`, { waitUntil: "load" });
  await expect(page.getByTestId("workbench-page-title")).toBeVisible();
  await page.getByTestId("workbench-tab-create").click();
  await expect(page.getByTestId("workbench-create-agent-button")).toBeVisible();
}

test.describe("Improve Prompt button", () => {
  test("button is visible and disabled when prompt is empty", async ({ page }) => {
    await goToCreateTab(page);

    const btn = page.getByTestId("workbench-improve-prompt-button");
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
  });

  test("button enables when prompt has text", async ({ page }) => {
    await goToCreateTab(page);

    const btn = page.getByTestId("workbench-improve-prompt-button");
    await expect(btn).toBeDisabled();

    await page.getByTestId("workbench-agent-system-prompt-input").fill("list all tickets");
    await expect(btn).toBeEnabled();
  });

  test("button works with mocked API", async ({ page }) => {
    // Mock the improve-prompt endpoint
    await page.route("**/api/workbench/improve-prompt", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          improved_prompt:
            "You are a ticket analysis agent.\n\n## Goal\nList and summarize all open tickets.\n\n## Steps\n1. Use csv_list_tickets to retrieve all tickets.\n2. Filter by status.\n3. Produce a summary.\n\n## Output\nReturn a markdown summary.",
        }),
      });
    });

    await goToCreateTab(page);

    // Type a basic prompt
    const promptInput = page.getByTestId("workbench-agent-system-prompt-input");
    await promptInput.fill("list all tickets");

    // Click improve
    const btn = page.getByTestId("workbench-improve-prompt-button");
    await btn.click();

    // Prompt should be replaced with the improved version
    await expect(promptInput).toHaveValue(/You are a ticket analysis agent/);
    await expect(promptInput).toHaveValue(/## Steps/);
  });

  test("template + improve workflow screenshot", async ({ page }) => {
    // Mock the improve endpoint
    await page.route("**/api/workbench/improve-prompt", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          improved_prompt:
            "You are an expert IT support data analyst.\n\n## Goal\nAnalyze ticket data to understand which topics, products, and services generate the most issues and find actionable patterns.\n\n## Steps\n1. Use csv_ticket_stats to get an overview of the ticket landscape.\n2. Use csv_search_tickets_with_details to examine ticket details.\n3. Analyze across dimensions: top topics, product/service breakdown, priority vs. product, resolution patterns, group workload.\n4. Identify actionable patterns and recommend focus areas.\n\n## Output Format\nPresent findings with counts and percentages where possible.\n\n## Constraints\n- Only reference data you actually retrieved.\n- Do not fabricate statistics.",
        }),
      });
    });

    await goToCreateTab(page);

    // Select a template first
    const templateSelect = page.getByTestId("workbench-template-select");
    await templateSelect.click();
    await page.getByText("Topic & Product Analysis").click();

    // Wait for form to populate
    await expect(
      page.getByTestId("workbench-agent-system-prompt-input"),
    ).not.toHaveValue("");

    // Take screenshot before improvement
    await page.screenshot({
      path: "screenshot-improve-prompt-before.png",
      fullPage: true,
    });

    // Click improve
    await page.getByTestId("workbench-improve-prompt-button").click();

    // Wait for improved prompt
    await expect(
      page.getByTestId("workbench-agent-system-prompt-input"),
    ).toHaveValue(/## Steps/);

    // Take screenshot after improvement
    await page.screenshot({
      path: "screenshot-improve-prompt-after.png",
      fullPage: true,
    });
  });
});
