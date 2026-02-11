import { expect, test } from "@playwright/test";

const APP_URL = process.env.E2E_APP_URL || "http://localhost:3001";

async function visit(page, path = "/") {
  const url = path === "/" ? APP_URL : `${APP_URL}${path}`;
  await page.goto(url, { waitUntil: "load" });
  await expect(page.getByText("CSV Ticket Viewer")).toBeVisible();
  await expect(page.getByTestId("tab-csvtickets")).toBeVisible();
}

test.describe("App shell", () => {
  test("loads csv tickets by default", async ({ page }) => {
    await visit(page);

    await expect(page.getByTestId("tab-csvtickets")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByText("CSV Ticket Data")).toBeVisible();
    await expect(page.getByText(/Showing \d+ of \d+ tickets/)).toBeVisible();
  });

  test("navigates across current tabs", async ({ page }) => {
    await visit(page);

    await page.getByTestId("tab-usecase-demo").click();
    await expect(page.getByTestId("tab-usecase-demo")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByText("Usecase Demo Description")).toBeVisible();

    await page.getByTestId("tab-usecase-demo-ops").click();
    await expect(page.getByTestId("tab-usecase-demo-ops")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByText("Operations Usecase Demo")).toBeVisible();

    await page.getByTestId("tab-fields").click();
    await expect(page.getByTestId("tab-fields")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByText("CSV Ticket Fields")).toBeVisible();

    await page.getByTestId("tab-kitchensink").click();
    await expect(page.getByTestId("tab-kitchensink")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByText("Kitchen Sink Demo")).toBeVisible();

    await page.getByTestId("tab-agent").click();
    await expect(page.getByTestId("tab-agent")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByTestId("agent-input")).toBeVisible();
  });

  test("supports direct URL navigation", async ({ page }) => {
    await visit(page, "/fields");
    await expect(page.getByTestId("tab-fields")).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await visit(page, "/usecase_demo_1");
    await expect(page.getByTestId("tab-usecase-demo")).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await visit(page, "/usecase_demo_ops");
    await expect(page.getByTestId("tab-usecase-demo-ops")).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await visit(page, "/agent");
    await expect(page.getByTestId("tab-agent")).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await visit(page, "/csvtickets");
    await expect(page.getByTestId("tab-csvtickets")).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});

test.describe("CSV tickets", () => {
  test("renders table and stats", async ({ page }) => {
    await visit(page, "/csvtickets");

    await expect(page.getByText("CSV Ticket Data")).toBeVisible();
    await expect(page.getByText("Total Tickets")).toBeVisible();

    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
  });

  test("supports pagination controls", async ({ page }) => {
    await visit(page, "/csvtickets");

    const pageLabel = page.getByText(/Page \d+ of \d+/);
    await expect(pageLabel).toBeVisible();

    const nextButton = page.getByRole("button", { name: "Next" });
    await expect(nextButton).toBeVisible();

    if (await nextButton.isEnabled()) {
      await nextButton.click();
      await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();
    }
  });
});

test.describe("Usecase demo page", () => {
  test("allows editing prompt and toggles start button state", async ({ page }) => {
    await visit(page, "/usecase_demo_1");

    const prompt = page.getByTestId("usecase-demo-prompt");
    const startButton = page.getByTestId("usecase-demo-start-agent");

    await expect(prompt).toBeVisible();
    await expect(prompt).toContainText("VPN");
    await expect(startButton).toBeEnabled();

    await prompt.fill("");
    await expect(startButton).toBeDisabled();

    await prompt.fill("Generate one ticket-backed usecase demo idea.");
    await expect(startButton).toBeEnabled();
  });

  test("starts a run and shows mocked result table", async ({ page }) => {
    let statusCalls = 0;

    await page.route("**/api/usecase-demo/agent-runs?limit=25", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ runs: [] }),
      });
    });

    await page.route("**/api/usecase-demo/agent-runs/run-1", async (route) => {
      statusCalls += 1;
      const completed = {
        id: "run-1",
        prompt: "mock prompt",
        status: "completed",
        created_at: "2026-02-11T10:00:00",
        started_at: "2026-02-11T10:00:01",
        completed_at: "2026-02-11T10:00:02",
        tools_used: ["csv_ticket_stats", "csv_search_tickets"],
        result_markdown:
          "## Summary\\nProject generated.\\n\\n```json\\n{\"rows\":[{\"menu_point\":\"Smart Routing\",\"project_name\":\"Auto Assignment Optimizer\",\"ticket_ids\":\"ticket-1\"}]}\\n```",
        result_rows: [
          {
            menu_point: "Smart Routing",
            project_name: "Auto Assignment Optimizer",
            ticket_ids: "ticket-1",
          },
        ],
        result_columns: ["menu_point", "project_name", "ticket_ids"],
        error: null,
      };

      const queued = {
        ...completed,
        status: "running",
        completed_at: null,
        result_rows: [],
        result_columns: [],
      };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(statusCalls >= 2 ? completed : queued),
      });
    });

    await page.route("**/api/usecase-demo/agent-runs", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({
            id: "run-1",
            prompt: "mock prompt",
            status: "queued",
            created_at: "2026-02-11T10:00:00",
            started_at: null,
            completed_at: null,
            tools_used: [],
            result_markdown: null,
            result_rows: [],
            result_columns: [],
            error: null,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ runs: [] }),
      });
    });

    await page.route("**/api/csv-tickets/ticket-1*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "ticket-1",
          summary: "VPN Failure on Remote Access",
          status: "pending",
          priority: "high",
          assignee: null,
          assigned_group: "Network Team",
          requester_name: "Alex Doe",
          city: "Geneva",
          service: "Network",
          description: "VPN clients cannot connect over LAN.",
          notes: "Issue started after update.",
          resolution: null,
        }),
      });
    });

    await visit(page, "/usecase_demo_1");

    await page.getByTestId("usecase-demo-prompt").fill("mock prompt");
    await page.getByTestId("usecase-demo-start-agent").click();

    await expect(page.getByText("Run ID: run-1")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Auto Assignment Optimizer" })).toBeVisible({ timeout: 12000 });
    await expect(page.getByText("Structured JSON Preview")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Copy JSON" })).toHaveCount(0);
    await expect(page.getByTestId("usecase-demo-ticket-open-ticket-1")).toBeVisible();
    await page.getByTestId("usecase-demo-ticket-open-ticket-1").click();
    await expect(page.getByTestId("usecase-demo-ticket-details")).toContainText("VPN Failure on Remote Access");
    await expect(page.getByTestId("usecase-demo-ticket-details")).toContainText("Network Team");
  });
});

test.describe("Ops usecase demo page", () => {
  test("uses config-specific prompt and markdown-only view", async ({ page }) => {
    await visit(page, "/usecase_demo_ops");

    const prompt = page.getByTestId("ops-demo-prompt");
    const startButton = page.getByTestId("ops-demo-start-agent");

    await expect(prompt).toBeVisible();
    await expect(prompt).toContainText("Outlook");
    await expect(startButton).toBeEnabled();

    await expect(page.getByText("Operations Result")).toBeVisible();
    await expect(page.getByText("No result available yet.")).toBeVisible();
    await expect(page.getByTestId("ops-demo-result-view-table")).toHaveCount(0);
    await expect(page.getByText("Matching Tickets")).toHaveCount(0);
  });
});

test.describe("Agent page", () => {
  test("has input and send button state behavior", async ({ page }) => {
    await visit(page, "/agent");

    const input = page.getByTestId("agent-input");
    const send = page.getByTestId("agent-send");

    await expect(input).toBeVisible();
    await expect(send).toBeDisabled();

    await input.fill("Show me ticket stats from CSV");
    await expect(send).toBeEnabled();
  });
});
