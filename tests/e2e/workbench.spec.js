import { expect, test } from "@playwright/test";

const APP_URL = process.env.E2E_APP_URL || "http://localhost:3001";

test.describe("Agent Workbench UI", () => {
  test("creates and deletes an agent", async ({ page }) => {
    const agentName = `e2e-agent-${Date.now()}`;

    await page.goto(`${APP_URL}/workbench`, { waitUntil: "load" });

    await expect(page.getByText("CSV Ticket Viewer")).toBeVisible();
    await expect(page.getByTestId("tab-workbench")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByTestId("workbench-page-title")).toBeVisible();

    await page.getByTestId("workbench-agent-name-input").fill(agentName);
    await page
      .getByTestId("workbench-agent-description-input")
      .fill("e2e create/delete smoke test");
    await page
      .getByTestId("workbench-agent-system-prompt-input")
      .fill("Use csv_ticket_stats and report the total.");

    const csvStatsToolCheckbox = page.getByTestId("workbench-tool-csv_ticket_stats");
    await expect(csvStatsToolCheckbox).toBeVisible();
    if ((await csvStatsToolCheckbox.getAttribute("aria-checked")) !== "true") {
      await csvStatsToolCheckbox.click();
    }

    await page.getByTestId("workbench-create-agent-button").click();

    const createdRow = page.locator(
      '[data-testid="workbench-agents-table"] tbody tr',
      { hasText: agentName }
    );
    await expect(createdRow).toBeVisible({ timeout: 10000 });

    await createdRow.getByRole("button", { name: "Delete" }).click();

    await expect(
      page.locator('[data-testid="workbench-agents-table"] tbody tr', {
        hasText: agentName,
      })
    ).toHaveCount(0, { timeout: 10000 });
  });
});
