import { expect, test } from "@playwright/test";

const APP_URL = process.env.E2E_APP_URL || "http://localhost:3001";

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
            "You are an expert Knowledge Base author specializing in IT support.\n\n## Goal\nCreate a comprehensive, reusable KBA from patterns found across related tickets.\n\n## Steps\n1. Use csv_search_tickets_with_details to find tickets matching the user's topic.\n2. Identify common symptoms across tickets.\n3. Determine the root cause from resolution notes.\n4. Write step-by-step resolution instructions.\n\n## Output Format\n- **Title**: Concise, searchable\n- **Symptoms**: Bullet list of what users experience\n- **Cause**: Root cause explanation\n- **Resolution**: Numbered steps\n- **Related Tickets**: INC numbers analyzed\n\n## Constraints\n- Only reference tickets you actually retrieved.\n- Do not fabricate resolution steps.",
        }),
      });
    });

    await goToCreateTab(page);

    // Select a template first
    const templateSelect = page.getByTestId("workbench-template-select");
    await templateSelect.click();
    await page.getByText("KBA from Multiple Tickets").click();

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
