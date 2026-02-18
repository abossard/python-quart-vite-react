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

    await page.getByTestId("tab-kba-builder").click();
    await expect(page.getByTestId("tab-kba-builder")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByTestId("tab-kba-builder")).toBeVisible();

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

    await visit(page, "/kba_draft_builder");
    await expect(page.getByTestId("tab-kba-builder")).toHaveAttribute(
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

test.describe("KBA Draft Builder", () => {
  test("displays German UI and ticket ID input", async ({ page }) => {
    await visit(page, "/kba_draft_builder");

    // Check for German labels
    await expect(page.getByRole("heading", { name: "KBA Draft Builder" })).toBeVisible();
    await expect(page.getByText(/Ticket-ID/i)).toBeVisible();
    await expect(page.getByText(/Gib eine Ticket-ID ein/i)).toBeVisible();

    // Check prompt has default ticket ID format
    const prompt = page.getByTestId("kba-builder-prompt");
    await expect(prompt).toBeVisible();
    await expect(prompt).toHaveValue(/INC\d+/);

    // Check start button is enabled with default value
    const startButton = page.getByTestId("kba-builder-start-agent");
    await expect(startButton).toBeEnabled();
  });

  test("generates KBA article with mocked backend", async ({ page }) => {
    let statusCalls = 0;

    // Mock the agent run status endpoint
    await page.route("**/api/usecase-demo/agent-runs/kba-run-1", async (route) => {
      statusCalls++;

      const queued = {
        id: "kba-run-1",
        prompt: "INC000004025175",
        agent_type: "kba_assistant",
        status: "queued",
        created_at: "2026-02-11T10:00:00",
        started_at: null,
        completed_at: null,
        tools_used: [],
        result_markdown: null,
        result_rows: [],
        result_columns: [],
        error: null,
      };

      const running = {
        ...queued,
        status: "running",
        started_at: "2026-02-11T10:00:05",
      };

      const completed = {
        ...queued,
        status: "completed",
        started_at: "2026-02-11T10:00:05",
        completed_at: "2026-02-11T10:00:15",
        tools_used: ["csv_get_ticket", "generate_kba_article"],
        result_markdown: `## KBA Artikel Generiert

\`\`\`json
{
  "ticket_id": "INC000004025175",
  "title": "Problem mit Update-Anzeige beheben",
  "question": "Warum werden keine Updates im System angezeigt?",
  "answer": "Das Problem tritt auf, wenn die Update-Benachrichtigungen deaktiviert sind. Lösung: 1. Öffnen Sie die Systemeinstellungen. 2. Navigieren Sie zu 'Updates & Sicherheit'. 3. Aktivieren Sie die Option 'Update-Benachrichtigungen anzeigen'. 4. Starten Sie die Anwendung neu."
}
\`\`\``,
        result_rows: [
          {
            ticket_id: "INC000004025175",
            title: "Problem mit Update-Anzeige beheben",
            question: "Warum werden keine Updates im System angezeigt?",
            answer: "Das Problem tritt auf, wenn die Update-Benachrichtigungen deaktiviert sind. Lösung: 1. Öffnen Sie die Systemeinstellungen. 2. Navigieren Sie zu 'Updates & Sicherheit'. 3. Aktivieren Sie die Option 'Update-Benachrichtigungen anzeigen'. 4. Starten Sie die Anwendung neu."
          }
        ],
        result_columns: ["ticket_id", "title", "question", "answer"],
      };

      const response = statusCalls === 1 ? queued : statusCalls === 2 ? running : completed;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    });

    // Mock the create run endpoint
    await page.route("**/api/usecase-demo/agent-runs", async (route) => {
      if (route.request().method() === "POST") {
        const postData = route.request().postDataJSON();
        
        // Verify agent_type is passed correctly
        expect(postData.agent_type).toBe("kba_assistant");
        
        await route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({
            id: "kba-run-1",
            prompt: postData.prompt,
            agent_type: "kba_assistant",
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

    await visit(page, "/kba_draft_builder");

    // Enter ticket ID and start generation
    await page.getByTestId("kba-builder-prompt").fill("INC000004025175");
    await page.getByTestId("kba-builder-start-agent").click();

    // Wait for completion (with polling)
    await expect(page.getByText("Run ID: kba-run-1")).toBeVisible();
    
    // Wait for KBA article to appear (with increased timeout for polling)
    await expect(page.getByText("Problem mit Update-Anzeige beheben")).toBeVisible({ timeout: 12000 });
    
    // Check German section labels
    await expect(page.getByText("❓ Frage")).toBeVisible();
    await expect(page.getByText("✅ Antwort")).toBeVisible();
    
    // Check KBA content
    await expect(page.getByText(/Warum werden keine Updates/i)).toBeVisible();
    await expect(page.getByText(/Systemeinstellungen/i)).toBeVisible();
    
    // Check source ticket reference
    await expect(page.getByText("Quelle: Ticket INC000004025175")).toBeVisible();
    
    // Verify KBA article was generated (tools are internal, not displayed)
  });

  test("handles missing Azure OpenAI configuration error", async ({ page }) => {
    await page.route("**/api/usecase-demo/agent-runs", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({
            id: "kba-error-run",
            prompt: "INC000004025175",
            agent_type: "kba_assistant",
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
    });

    await page.route("**/api/usecase-demo/agent-runs/kba-error-run", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "kba-error-run",
          prompt: "INC000004025175",
          agent_type: "kba_assistant",
          status: "failed",
          created_at: "2026-02-11T10:00:00",
          started_at: "2026-02-11T10:00:05",
          completed_at: "2026-02-11T10:00:08",
          tools_used: [],
          result_markdown: null,
          result_rows: [],
          result_columns: [],
          error: "Azure OpenAI configuration missing. Please set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT in .env file.",
        }),
      });
    });

    await visit(page, "/kba_draft_builder");

    await page.getByTestId("kba-builder-prompt").fill("INC000004025175");
    await page.getByTestId("kba-builder-start-agent").click();

    // Should show error message
    await expect(page.getByText(/Azure OpenAI configuration missing/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/AZURE_OPENAI_ENDPOINT/i)).toBeVisible();
  });

  test("handles ticket not found error", async ({ page }) => {
    await page.route("**/api/usecase-demo/agent-runs", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({
            id: "kba-notfound-run",
            prompt: "INC999999999999",
            agent_type: "kba_assistant",
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
    });

    await page.route("**/api/usecase-demo/agent-runs/kba-notfound-run", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "kba-notfound-run",
          prompt: "INC999999999999",
          agent_type: "kba_assistant",
          status: "completed",
          created_at: "2026-02-11T10:00:00",
          started_at: "2026-02-11T10:00:05",
          completed_at: "2026-02-11T10:00:08",
          tools_used: ["csv_search_tickets"],
          result_markdown: "Ticket INC999999999999 wurde nicht gefunden.",
          result_rows: [],
          result_columns: [],
          error: null,
        }),
      });
    });

    await visit(page, "/kba_draft_builder");

    await page.getByTestId("kba-builder-prompt").fill("INC999999999999");
    await page.getByTestId("kba-builder-start-agent").click();

    // Should show "not found" message
    await expect(page.getByText(/Kein KBA-Artikel gefunden/i)).toBeVisible({ timeout: 8000 });
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
