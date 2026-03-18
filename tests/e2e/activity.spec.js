import { expect, test } from "@playwright/test";

const APP_URL = process.env.E2E_APP_URL || "http://localhost:3001";

async function visit(page, path = "/") {
  const url = path === "/" ? APP_URL : `${APP_URL}${path}`;
  await page.goto(url, { waitUntil: "load" });
  await expect(page.getByText("CSV Ticket Viewer")).toBeVisible();
}

test.describe("Activity page", () => {
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
    await expect(page.getByText("No events yet")).toBeVisible();
    await expect(page.getByTestId("activity-reconnect")).toBeVisible();
    await expect(page.getByTestId("activity-clear")).toBeVisible();
  });

  test("direct URL navigation works", async ({ page }) => {
    await visit(page, "/activity");

    const activityTab = page.getByTestId("tab-activity");
    await expect(activityTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("activity-page")).toBeVisible();
  });

  test("renders SSE events from mocked stream", async ({ page }) => {
    // Mock the SSE endpoint to send test events
    await page.route("**/api/workbench/events", async (route) => {
      const events = [
        {
          run_id: "test-run-123",
          event_type: "run_started",
          data: {
            agent_id: "agent-1",
            agent_name: "Test Agent",
            input_preview: "Hello world",
          },
          timestamp: Date.now() / 1000,
        },
        {
          run_id: "test-run-123",
          event_type: "tool_start",
          data: { tool_name: "csv_search_tickets", input: '{"query": "VPN"}' },
          timestamp: Date.now() / 1000 + 1,
        },
        {
          run_id: "test-run-123",
          event_type: "tool_end",
          data: {
            tool_name: "csv_search_tickets",
            output: "Found 5 tickets",
            duration_ms: 42,
          },
          timestamp: Date.now() / 1000 + 2,
        },
        {
          run_id: "test-run-123",
          event_type: "run_completed",
          data: {
            output_preview: "Analysis complete",
            tools_used: ["csv_search_tickets"],
            duration_ms: 1500,
          },
          timestamp: Date.now() / 1000 + 3,
        },
      ];

      const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");

      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
        body,
      });
    });

    await visit(page, "/activity");

    // Wait for events to render
    await expect(page.getByTestId("activity-event").first()).toBeVisible({
      timeout: 5000,
    });

    // Verify event count
    const eventRows = page.getByTestId("activity-event");
    await expect(eventRows).toHaveCount(4);

    // Verify event content
    await expect(page.getByText('Test Agent')).toBeVisible();
    await expect(page.getByText(/csv_search_tickets/).first()).toBeVisible();

    // Verify run_id badge is shown
    await expect(page.getByText("test-run").first()).toBeVisible();
  });

  test("clear button removes all events", async ({ page }) => {
    // Mock with one event
    await page.route("**/api/workbench/events", async (route) => {
      const event = {
        run_id: "clear-test",
        event_type: "run_started",
        data: { agent_name: "Clear Test Agent", input_preview: "test" },
        timestamp: Date.now() / 1000,
      };
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: `data: ${JSON.stringify(event)}\n\n`,
      });
    });

    await visit(page, "/activity");
    await expect(page.getByTestId("activity-event").first()).toBeVisible({
      timeout: 5000,
    });

    // Click clear
    await page.getByTestId("activity-clear").click();

    // Should show empty state
    await expect(page.getByText("No events yet")).toBeVisible();
  });

  test("filters events by run_id via URL query param", async ({ page }) => {
    await page.route("**/api/workbench/events", async (route) => {
      const now = Date.now() / 1000;
      const events = [
        { run_id: "run-aaa", event_type: "run_started", data: { agent_name: "Agent A" }, timestamp: now },
        { run_id: "run-aaa", event_type: "tool_start", data: { tool_name: "csv_search_tickets", input: "test" }, timestamp: now + 1 },
        { run_id: "run-bbb", event_type: "run_started", data: { agent_name: "Agent B" }, timestamp: now + 2 },
        { run_id: "run-aaa", event_type: "run_completed", data: { tools_used: ["csv_search_tickets"], duration_ms: 500 }, timestamp: now + 3 },
      ];
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""),
      });
    });

    // Navigate with filter
    await visit(page, "/activity?run_id=run-aaa");

    // Filter bar should be visible
    await expect(page.getByTestId("activity-filter-bar")).toBeVisible();
    await expect(page.getByTestId("activity-filter-bar")).toContainText("run-aaa");

    // Should only show run-aaa events (3 out of 4)
    await expect(page.getByTestId("activity-event")).toHaveCount(3);

    // Clear filter
    await page.getByTestId("activity-clear-filter").click();
    await expect(page.getByTestId("activity-filter-bar")).not.toBeVisible();

    // All 4 events should show
    await expect(page.getByTestId("activity-event")).toHaveCount(4);
  });

  test("clicking run_id badge filters to that run", async ({ page }) => {
    await page.route("**/api/workbench/events", async (route) => {
      const now = Date.now() / 1000;
      const events = [
        { run_id: "run-xxx", event_type: "run_started", data: { agent_name: "Agent X" }, timestamp: now },
        { run_id: "run-yyy", event_type: "run_started", data: { agent_name: "Agent Y" }, timestamp: now + 1 },
      ];
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""),
      });
    });

    await visit(page, "/activity");
    await expect(page.getByTestId("activity-event")).toHaveCount(2);

    // Click the first run_id badge (run-xxx) using aria-label
    await page.getByLabel("Filter by run run-xxx").click();

    // Filter bar should appear and only 1 event visible
    await expect(page.getByTestId("activity-filter-bar")).toBeVisible();
    await expect(page.getByTestId("activity-event")).toHaveCount(1);
  });

  test("takes a screenshot of the activity page", async ({ page }) => {
    // Mock with diverse events for a good screenshot
    await page.route("**/api/workbench/events", async (route) => {
      const now = Date.now() / 1000;
      const events = [
        {
          run_id: "demo-run-abc12345",
          event_type: "run_started",
          data: {
            agent_id: "ticket-analyzer",
            agent_name: "Ticket Analyzer",
            input_preview: "Analyze VPN-related tickets and find common patterns",
          },
          timestamp: now,
        },
        {
          run_id: "demo-run-abc12345",
          event_type: "llm_start",
          data: { model: "gpt-4o" },
          timestamp: now + 0.5,
        },
        {
          run_id: "demo-run-abc12345",
          event_type: "llm_end",
          data: {
            model: "gpt-4o",
            duration_ms: 1200,
            token_usage: { total_tokens: 450 },
            finish_reason: "stop",
          },
          timestamp: now + 1.7,
        },
        {
          run_id: "demo-run-abc12345",
          event_type: "tool_start",
          data: {
            tool_name: "csv_search_tickets",
            input: '{"query": "VPN connection failure"}',
          },
          timestamp: now + 2,
        },
        {
          run_id: "demo-run-abc12345",
          event_type: "tool_end",
          data: {
            tool_name: "csv_search_tickets",
            output:
              '[{"incident_id": "INC000016349327", "summary": "VPN Failure"}, {"incident_id": "INC000016349815", "summary": "VPN timeout"}]',
            duration_ms: 85,
          },
          timestamp: now + 2.1,
        },
        {
          run_id: "demo-run-abc12345",
          event_type: "tool_start",
          data: {
            tool_name: "csv_ticket_stats",
            input: "{}",
          },
          timestamp: now + 3,
        },
        {
          run_id: "demo-run-abc12345",
          event_type: "tool_end",
          data: {
            tool_name: "csv_ticket_stats",
            output: '{"total": 156, "open": 42, "closed": 114}',
            duration_ms: 12,
          },
          timestamp: now + 3.02,
        },
        {
          run_id: "demo-run-abc12345",
          event_type: "llm_start",
          data: { model: "gpt-4o" },
          timestamp: now + 3.5,
        },
        {
          run_id: "demo-run-abc12345",
          event_type: "llm_end",
          data: {
            model: "gpt-4o",
            duration_ms: 2100,
            token_usage: { total_tokens: 820 },
            finish_reason: "stop",
          },
          timestamp: now + 5.6,
        },
        {
          run_id: "demo-run-abc12345",
          event_type: "run_completed",
          data: {
            output_preview:
              "Found 12 VPN-related tickets. Common patterns: connection timeouts (5), auth failures (4), split-tunnel issues (3).",
            tools_used: ["csv_search_tickets", "csv_ticket_stats"],
            duration_ms: 5800,
          },
          timestamp: now + 5.8,
        },
      ];

      const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body,
      });
    });

    await visit(page, "/activity");
    await expect(page.getByTestId("activity-event").first()).toBeVisible({
      timeout: 5000,
    });

    // Wait for all events to render
    await expect(page.getByTestId("activity-event")).toHaveCount(10);

    await page.screenshot({
      path: "screenshot-activity.png",
      fullPage: true,
    });
  });
});
