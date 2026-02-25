import { expect, test } from "@playwright/test";

const APP_URL = process.env.E2E_APP_URL || "http://localhost:3001";

test.describe("Agent Fabric UI", () => {
  test("creates and deletes an agent", async ({ page }) => {
    const agentName = `e2e-agent-${Date.now()}`;

    await page.goto(`${APP_URL}/workbench`, { waitUntil: "load" });

    await expect(page.getByText("CSV Ticket Viewer")).toBeVisible();
    await expect(page.getByTestId("tab-workbench")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByTestId("workbench-page-title")).toBeVisible();

    await page.getByTestId("workbench-create-agent-button").click();
    await expect(page.getByText("Agent name is required")).toBeVisible();
    await expect(page.getByText("System prompt is required")).toBeVisible();

    await page.getByTestId("workbench-agent-name-input").fill(agentName);
    await page
      .getByTestId("workbench-agent-description-input")
      .fill("e2e create/delete smoke test");
    await page
      .getByTestId("workbench-agent-system-prompt-input")
      .fill("Use csv_ticket_stats and report the total.");

    const csvStatsToolCheckbox = page.getByTestId("workbench-tool-csv_ticket_stats");
    await expect(csvStatsToolCheckbox).toBeVisible();
    await expect(csvStatsToolCheckbox).toBeChecked();

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

  test("runs an agent and appends output to run button", async ({ page }) => {
    const agentName = `e2e-run-agent-${Date.now()}`;

    await page.route("**/api/workbench/agents/*/runs", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "run-e2e-1",
          agent_id: "agent-e2e-1",
          input_prompt: "Summarize ticket trends",
          status: "completed",
          output: "Ticket trend summary: high priority incidents are concentrated in Network services.",
          agent_snapshot: { tool_names: ["csv_ticket_stats"] },
          tools_used: ["csv_ticket_stats"],
          error: null,
          created_at: "2026-02-25T10:00:00Z",
          completed_at: "2026-02-25T10:00:01Z",
        }),
      });
    });

    await page.goto(`${APP_URL}/workbench`, { waitUntil: "load" });
    await expect(page.getByTestId("workbench-page-title")).toBeVisible();

    await page.getByTestId("workbench-agent-name-input").fill(agentName);
    await page
      .getByTestId("workbench-agent-system-prompt-input")
      .fill("Use csv_ticket_stats and summarize.");
    await page.getByTestId("workbench-create-agent-button").click();

    const createdRow = page.locator(
      '[data-testid="workbench-agents-table"] tbody tr',
      { hasText: agentName }
    );
    await expect(createdRow).toBeVisible({ timeout: 10000 });

    await page
      .getByTestId("workbench-run-prompt-input")
      .fill("Summarize ticket trends");
    await page.getByTestId("workbench-run-agent-button").click();

    await expect(page.getByTestId("workbench-run-agent-button")).toContainText("Running");
    await expect(page.getByTestId("workbench-run-agent-button")).toContainText("Last output:", {
      timeout: 10000,
    });
    await expect(page.getByTestId("workbench-run-output")).toContainText(
      "Ticket trend summary",
      { timeout: 10000 }
    );
  });
});
