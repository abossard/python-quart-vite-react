import { expect, test } from "@playwright/test";
import {
  APP_URL,
  BACKEND_URL,
  cleanupAgents,
  createAgentViaAPI,
  runAgentViaAPI,
  visit,
  waitForRunCompletion,
} from "./helpers.js";

test.describe("Activity page", () => {
  test.describe.configure({ mode: "serial" });

  test("tab exists and navigates to activity page", async ({ page }) => {
    await visit(page);

    const activityTab = page.getByTestId("tab-activity");
    await expect(activityTab).toBeVisible();

    await activityTab.click();
    await expect(activityTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("activity-page")).toBeVisible();
  });

  test("shows empty state and connection status", async ({ page }) => {
    await visit(page, "/activity");

    await expect(page.getByTestId("activity-page")).toBeVisible();
    await expect(page.getByText("Agent Activity")).toBeVisible();
    await expect(page.getByTestId("activity-status")).toBeVisible();
    await expect(page.getByTestId("activity-reconnect")).toBeVisible();
    await expect(page.getByTestId("activity-clear")).toBeVisible();
  });

  test("direct URL navigation works", async ({ page }) => {
    await visit(page, "/activity");

    const activityTab = page.getByTestId("tab-activity");
    await expect(activityTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("activity-page")).toBeVisible();
  });

  test("renders SSE events from real agent run", async ({ page }) => {
    // Navigate first to establish SSE connection
    await visit(page, "/activity");
    await expect(page.getByTestId("activity-page")).toBeVisible();

    // Create and run agent — events stream to the connected page
    const agent = await createAgentViaAPI(page, { name: "e2e-act-sse" });
    const run = await runAgentViaAPI(page, agent.id);
    await waitForRunCompletion(page, run.id);

    // Wait for events to render
    await expect(page.getByTestId("activity-event").first()).toBeVisible({
      timeout: 10000,
    });

    // Verify tool name appears in events
    await expect(
      page.getByText(/csv_ticket_stats/).first(),
    ).toBeVisible();

    // Verify run_id badge
    const runIdShort = run.id.substring(0, 8);
    await expect(page.getByText(runIdShort).first()).toBeVisible();
  });

  test("clear button removes all events", async ({ page }) => {
    await visit(page, "/activity");

    const agent = await createAgentViaAPI(page, { name: "e2e-act-clear" });
    const run = await runAgentViaAPI(page, agent.id);
    await waitForRunCompletion(page, run.id);

    await expect(page.getByTestId("activity-event").first()).toBeVisible({
      timeout: 10000,
    });

    // Click clear
    await page.getByTestId("activity-clear").click();

    // Should show empty state
    await expect(page.getByText("No events yet")).toBeVisible();
  });

  test("filters events by run_id via URL query param", async ({ page }) => {
    const ts = Date.now();
    const agentA = await createAgentViaAPI(page, { name: `e2e-act-${ts}-filter-a` });
    const agentB = await createAgentViaAPI(page, { name: `e2e-act-${ts}-filter-b` });

    // First run agent A and get the run ID
    const runA = await runAgentViaAPI(page, agentA.id);
    await waitForRunCompletion(page, runA.id);

    // Navigate with filter for run A — SSE connection starts filtered
    await page.goto(`${APP_URL}/activity?run_id=${runA.id}`, {
      waitUntil: "load",
    });
    await expect(page.getByText("CSV Ticket Viewer")).toBeVisible();

    // Filter bar should be visible
    await expect(page.getByTestId("activity-filter-bar")).toBeVisible();
    await expect(page.getByTestId("activity-filter-bar")).toContainText(
      runA.id.substring(0, 8),
    );

    // Now run agent B — its events will arrive but should be filtered out
    const runB = await runAgentViaAPI(page, agentB.id);
    await waitForRunCompletion(page, runB.id);

    // Wait for run A events to appear (emitted during initial run, may replay)
    // The real SSE may not replay old events, so we run agent A again
    const runA2 = await runAgentViaAPI(page, agentA.id);
    await waitForRunCompletion(page, runA2.id);

    // Wait for filtered events
    await expect(page.getByTestId("activity-event").first()).toBeVisible({
      timeout: 10000,
    });

    // All visible events should belong to agent A's runs
    const filteredCount = await page.getByTestId("activity-event").count();
    expect(filteredCount).toBeGreaterThan(0);

    // Clear filter should show events from both agents
    await page.getByTestId("activity-clear-filter").click();
    await expect(page.getByTestId("activity-filter-bar")).not.toBeVisible();
    const totalCount = await page.getByTestId("activity-event").count();
    expect(totalCount).toBeGreaterThanOrEqual(filteredCount);
  });

  test("clicking run_id badge filters to that run", async ({ page }) => {
    const ts = Date.now();
    await visit(page, "/activity");

    const agentA = await createAgentViaAPI(page, { name: `e2e-act-${ts}-badge-a` });
    const agentB = await createAgentViaAPI(page, { name: `e2e-act-${ts}-badge-b` });

    const runA = await runAgentViaAPI(page, agentA.id);
    await waitForRunCompletion(page, runA.id);
    const runB = await runAgentViaAPI(page, agentB.id);
    await waitForRunCompletion(page, runB.id);

    await expect(page.getByTestId("activity-event").first()).toBeVisible({
      timeout: 10000,
    });
    const totalBefore = await page.getByTestId("activity-event").count();
    expect(totalBefore).toBeGreaterThanOrEqual(2);

    // Click the run_id badge for run A
    const runAShort = runA.id.substring(0, 8);
    await page.getByLabel(`Filter by run ${runAShort}`).first().click();

    // Filter bar should appear
    await expect(page.getByTestId("activity-filter-bar")).toBeVisible();
    const filteredCount = await page.getByTestId("activity-event").count();
    expect(filteredCount).toBeLessThan(totalBefore);
  });

  test("takes a screenshot of the activity page", async ({ page }) => {
    await visit(page, "/activity");

    const agent = await createAgentViaAPI(page, { name: "e2e-act-screenshot" });
    const run = await runAgentViaAPI(page, agent.id);
    await waitForRunCompletion(page, run.id);

    await expect(page.getByTestId("activity-event").first()).toBeVisible({
      timeout: 10000,
    });

    await page.screenshot({
      path: "screenshot-activity.png",
      fullPage: true,
    });
  });
});
