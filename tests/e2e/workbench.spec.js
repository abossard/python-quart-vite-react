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
          output: "# Ticket trend summary\n\n- High priority incidents are concentrated in **Network services**.",
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
    await expect(
      page.locator('[data-testid="workbench-run-output"] h1')
    ).toHaveText("Ticket trend summary");
  });

  test("requires and forwards configured run input", async ({ page }) => {
    const agentName = `e2e-required-input-${Date.now()}`;

    await page.route("**/api/workbench/agents/*/runs", async (route) => {
      const body = route.request().postDataJSON();
      const requiredInputValue = body?.required_input_value || "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "run-e2e-required-1",
          agent_id: "agent-e2e-required-1",
          input_prompt: body?.input_prompt || "",
          status: "completed",
          output: `Processed required input: ${requiredInputValue}`,
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
    await page.getByTestId("workbench-agent-requires-input-checkbox").click();
    await page.getByTestId("workbench-create-agent-button").click();
    await expect(page.getByText("Input description is required when input is required")).toBeVisible();

    await page
      .getByTestId("workbench-agent-required-input-description")
      .fill("Ticket INC number");
    await page.getByTestId("workbench-create-agent-button").click();

    const createdRow = page.locator(
      '[data-testid="workbench-agents-table"] tbody tr',
      { hasText: agentName }
    );
    await expect(createdRow).toBeVisible({ timeout: 10000 });

    await expect(page.getByTestId("workbench-run-required-input")).toBeVisible();
    await page.getByTestId("workbench-run-agent-button").click();
    await expect(page.getByText("Required input is needed: Ticket INC number")).toBeVisible();

    await page.getByTestId("workbench-run-required-input").fill("INC-987654");
    await page.getByTestId("workbench-run-agent-button").click();

    await expect(page.getByTestId("workbench-run-agent-button")).toContainText("Running");
    await expect(page.getByTestId("workbench-run-output")).toContainText(
      "Processed required input: INC-987654",
      { timeout: 10000 }
    );
  });

  test("creates agent with output schema via suggest button", async ({ page }) => {
    const agentName = `e2e-schema-${Date.now()}`;

    // Mock the suggest-schema endpoint
    await page.route("**/api/workbench/suggest-schema", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          schema: {
            type: "object",
            properties: {
              total: { type: "integer", description: "Total ticket count" },
              status_breakdown: { type: "object", description: "Count per status" },
            },
          },
        }),
      });
    });

    await page.goto(`${APP_URL}/workbench`, { waitUntil: "load" });
    await expect(page.getByTestId("workbench-page-title")).toBeVisible();

    // Fill agent form
    await page.getByTestId("workbench-agent-name-input").fill(agentName);
    await page
      .getByTestId("workbench-agent-system-prompt-input")
      .fill("Analyze ticket stats and report totals.");

    // Click suggest schema
    await page.getByTestId("workbench-suggest-schema-button").click();

    // Wait for schema to appear in the textarea
    // Wait for schema editor to populate with properties from suggestion
    const editor = page.getByTestId("schema-editor");
    await expect(editor).toBeVisible({ timeout: 5000 });
    // Properties should appear as input fields in the editor
    await expect(editor.locator('input[value="total"]')).toBeVisible({ timeout: 5000 });

    // Create the agent (schema should be included)
    await page.getByTestId("workbench-create-agent-button").click();

    const createdRow = page.locator(
      '[data-testid="workbench-agents-table"] tbody tr',
      { hasText: agentName }
    );
    await expect(createdRow).toBeVisible({ timeout: 10000 });

    // Clean up
    await createdRow.getByRole("button", { name: "Delete" }).click();
    await expect(
      page.locator('[data-testid="workbench-agents-table"] tbody tr', {
        hasText: agentName,
      })
    ).toHaveCount(0, { timeout: 10000 });
  });

  test("runs VPN troubleshooting agent and verifies structured output", async ({ page }) => {
    const agentName = `e2e-vpn-agent-${Date.now()}`;

    // Mock run endpoint with realistic VPN analysis structured output
    await page.route("**/api/workbench/agents/*/runs", async (route) => {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "run-vpn-1",
          agent_id: "agent-vpn-1",
          input_prompt: body?.input_prompt || "",
          status: "completed",
          output: JSON.stringify({
            message: "## VPN-Probleme Analyse\n\nEs wurden **4 VPN-bezogene Tickets** gefunden:\n\n| Ticket | Problem | Status |\n|--------|---------|--------|\n| INC-101 | VPN deaktivieren | assigned |\n| INC-205 | MS-VPN verbindet nicht | in_progress |\n| INC-312 | VPN Slowdown Evenings | pending |\n| INC-401 | VPN im Homeoffice nicht vorhanden | assigned |\n\n**Empfehlung:** Die meisten VPN-Probleme betreffen die Abendstunden und Homeoffice-Verbindungen.",
            referenced_tickets: ["INC-101", "INC-205", "INC-312", "INC-401"],
          }, null, 2),
          agent_snapshot: {
            tool_names: ["csv_search_tickets", "csv_ticket_stats"],
            system_prompt: "Analyze VPN issues in ticket data",
          },
          tools_used: ["csv_search_tickets", "csv_ticket_stats"],
          error: null,
          created_at: "2026-03-04T09:00:00Z",
          completed_at: "2026-03-04T09:00:03Z",
        }),
      });
    });

    await page.goto(`${APP_URL}/workbench`, { waitUntil: "load" });
    await expect(page.getByTestId("workbench-page-title")).toBeVisible();

    // Create the VPN agent
    await page.getByTestId("workbench-agent-name-input").fill(agentName);
    await page
      .getByTestId("workbench-agent-description-input")
      .fill("Analyzes VPN connectivity issues in ticket data");
    await page
      .getByTestId("workbench-agent-system-prompt-input")
      .fill("Search for VPN-related tickets using csv_search_tickets. Report findings with ticket IDs.");
    await page.getByTestId("workbench-create-agent-button").click();

    const createdRow = page.locator(
      '[data-testid="workbench-agents-table"] tbody tr',
      { hasText: agentName }
    );
    await expect(createdRow).toBeVisible({ timeout: 10000 });

    // Run the agent with a VPN prompt
    await page
      .getByTestId("workbench-run-prompt-input")
      .fill("Finde alle VPN-bezogenen Tickets und analysiere die Probleme");
    await page.getByTestId("workbench-run-agent-button").click();

    // Verify running state
    await expect(page.getByTestId("workbench-run-agent-button")).toContainText("Running");

    // Verify output renders with VPN content
    const output = page.getByTestId("workbench-run-output");
    await expect(output).toContainText("VPN", { timeout: 10000 });
    await expect(output).toContainText("INC-101");
    await expect(output).toContainText("INC-312");

    // Referenced tickets rendered as badges by SchemaRenderer
    await expect(page.locator('[data-testid="schema-renderer"]')).toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'INC-401' })).toBeVisible();

    // Verify button shows completion
    await expect(page.getByTestId("workbench-run-agent-button")).toContainText("Last output:", {
      timeout: 10000,
    });

    // Clean up
    await createdRow.getByRole("button", { name: "Delete" }).click();
  });

  test("handles agent run failure gracefully", async ({ page }) => {
    const agentName = `e2e-fail-agent-${Date.now()}`;

    // Mock run endpoint that returns a failed run
    await page.route("**/api/workbench/agents/*/runs", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "run-fail-1",
          agent_id: "agent-fail-1",
          input_prompt: "test",
          status: "failed",
          output: null,
          agent_snapshot: { tool_names: ["csv_ticket_stats"] },
          tools_used: [],
          error: "OPENAI_API_KEY not configured",
          created_at: "2026-03-04T09:00:00Z",
          completed_at: "2026-03-04T09:00:01Z",
        }),
      });
    });

    await page.goto(`${APP_URL}/workbench`, { waitUntil: "load" });

    await page.getByTestId("workbench-agent-name-input").fill(agentName);
    await page
      .getByTestId("workbench-agent-system-prompt-input")
      .fill("Test failure handling");
    await page.getByTestId("workbench-create-agent-button").click();

    const createdRow = page.locator(
      '[data-testid="workbench-agents-table"] tbody tr',
      { hasText: agentName }
    );
    await expect(createdRow).toBeVisible({ timeout: 10000 });

    await page.getByTestId("workbench-run-agent-button").click();

    // Output should show even for failed runs (no output = shows fallback)
    await expect(page.getByTestId("workbench-run-agent-button")).toContainText("Last output:", {
      timeout: 10000,
    });

    // Clean up
    await createdRow.getByRole("button", { name: "Delete" }).click();
  });
});

test.describe("Agent Chat UI", () => {
  test("sends message and displays mocked response", async ({ page }) => {
    // Mock the agent chat endpoint
    await page.route("**/api/agents/run", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: "# Ticket Stats\n\n| Status | Count |\n|--------|-------|\n| Open | 42 |\n| Closed | 18 |",
          agent_type: "task_assistant",
          tools_used: ["csv_ticket_stats"],
          error: null,
          created_at: "2026-03-04T10:00:00Z",
        }),
      });
    });

    await page.goto(`${APP_URL}/agent`, { waitUntil: "load" });

    const input = page.getByTestId("agent-input");
    const send = page.getByTestId("agent-send");

    await expect(input).toBeVisible();
    await expect(send).toBeDisabled();

    // Type and send
    await input.fill("Show me ticket stats");
    await expect(send).toBeEnabled();
    await send.click();

    // Wait for response to render (use heading role to avoid matching user input)
    await expect(page.getByRole("heading", { name: "Ticket Stats" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("csv_ticket_stats")).toBeVisible();
  });
});

test.describe("SchemaRenderer widgets", () => {
  test("renders structured output with table, stat-card, and badges", async ({ page }) => {
    const agentName = `e2e-widgets-${Date.now()}`;

    // Mock run with rich structured output containing multiple widget types
    await page.route("**/api/workbench/agents/*/runs", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "run-widgets-1",
          agent_id: "agent-widgets-1",
          input_prompt: "Analyze VPN connectivity",
          status: "completed",
          output: JSON.stringify({
            message: "## VPN Connectivity Report\n\nAnalyzed 3 VPN-related tickets.",
            affected_users: [
              { user: "Alice", issue: "VPN deaktivieren", status: "assigned" },
              { user: "Bob", issue: "MS-VPN verbindet nicht", status: "in_progress" },
            ],
            total_issues: 3,
            issue_types: ["VPN-001", "VPN-002", "VPN-003"],
          }, null, 2),
          agent_snapshot: { tool_names: ["csv_search_tickets"] },
          tools_used: ["csv_search_tickets"],
          error: null,
          created_at: "2026-03-04T10:00:00Z",
          completed_at: "2026-03-04T10:00:02Z",
        }),
      });
    });

    await page.goto(`${APP_URL}/workbench`, { waitUntil: "load" });
    await expect(page.getByTestId("workbench-page-title")).toBeVisible();

    // Create agent
    await page.getByTestId("workbench-agent-name-input").fill(agentName);
    await page.getByTestId("workbench-agent-system-prompt-input").fill("Analyze VPN issues");
    await page.getByTestId("workbench-create-agent-button").click();

    const createdRow = page.locator(
      '[data-testid="workbench-agents-table"] tbody tr',
      { hasText: agentName }
    );
    await expect(createdRow).toBeVisible({ timeout: 10000 });

    // Run agent
    await page.getByTestId("workbench-run-agent-button").click();

    // Wait for SchemaRenderer to appear
    const renderer = page.getByTestId("schema-renderer");
    await expect(renderer).toBeVisible({ timeout: 10000 });

    // Verify markdown widget rendered (message field)
    await expect(renderer.getByRole("heading", { name: "VPN Connectivity Report" })).toBeVisible();

    // Verify table widget auto-detected (affected_users is array of objects)
    await expect(renderer.locator("table")).toBeVisible();
    await expect(renderer.getByText("Alice")).toBeVisible();
    await expect(renderer.getByText("Bob")).toBeVisible();
    await expect(renderer.locator("th", { hasText: "user" })).toBeVisible();

    // Verify stat-card auto-detected (total_issues is integer)
    const statField = renderer.getByTestId("schema-field-total_issues");
    await expect(statField).toBeVisible();
    await expect(statField.getByText("3")).toBeVisible();

    // Verify badge-list auto-detected (issue_types is array of strings)
    await expect(renderer.getByText("VPN-001")).toBeVisible();
    await expect(renderer.getByText("VPN-003")).toBeVisible();

    // Clean up
    await createdRow.getByRole("button", { name: "Delete" }).click();
  });
});
