import { expect, test } from "@playwright/test";

const APP_URL = process.env.E2E_APP_URL || "http://localhost:3001";
const BACKEND_URL = APP_URL.replace("3001", "5001");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mock the runs list endpoint so the RunsSidePanel doesn't fail to load. */
function mockEmptyRuns(page) {
  return page.route("**/api/workbench/runs", async (route) => {
    const url = route.request().url();
    // Only intercept the exact /api/workbench/runs endpoint, not /agents/*/runs
    if (url.includes("/agents/") ) {
      await route.continue();
      return;
    }
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ runs: [] }),
      });
    } else {
      await route.continue();
    }
  });
}

/** Navigate to workbench and switch to the "Create Agent" tab. */
async function goToCreateTab(page) {
  await page.goto(`${APP_URL}/workbench`, { waitUntil: "load" });
  await expect(page.getByTestId("workbench-page-title")).toBeVisible();
  await page.getByTestId("workbench-tab-create").click();
  await expect(page.getByTestId("workbench-create-agent-button")).toBeVisible();
}

/** Switch to the "Agents" tab and wait for it to be selected. */
async function goToAgentsTab(page) {
  await page.getByTestId("workbench-tab-agents").click();
  await expect(page.getByTestId("workbench-tab-agents")).toHaveAttribute(
    "aria-selected",
    "true",
  );
}

/** Select csv_ticket_stats tool (required since tools default to empty). */
async function selectDefaultTool(page) {
  const cb = page.getByTestId("workbench-tool-csv_ticket_stats");
  if (await cb.isVisible({ timeout: 2000 }).catch(() => false)) {
    if (!(await cb.isChecked())) await cb.click();
  }
}

/**
 * Create an agent via the UI form on the Create Agent tab.
 * Fills the form, submits, and returns to the Agents tab.
 */
async function createAgent(
  page,
  {
    name,
    description = "",
    systemPrompt = "Use csv_ticket_stats and report the total.",
    requiresInput = false,
    requiredInputDescription = "",
    showInMenu = false,
  },
) {
  await goToCreateTab(page);

  await page.getByTestId("workbench-agent-name-input").fill(name);
  if (description) {
    await page.getByTestId("workbench-agent-description-input").fill(description);
  }
  await page.getByTestId("workbench-agent-system-prompt-input").fill(systemPrompt);

  // Select at least one tool (tools default to none)
  await selectDefaultTool(page);

  if (requiresInput) {
    await page.getByTestId("workbench-agent-requires-input-checkbox").click();
    if (requiredInputDescription) {
      await page
        .getByTestId("workbench-agent-required-input-description")
        .fill(requiredInputDescription);
    }
  }
  if (showInMenu) {
    await page.getByTestId("workbench-agent-show-in-menu-checkbox").click();
  }

  await page.getByTestId("workbench-create-agent-button").click();

  // After successful creation the page auto-switches to agents tab
  await expect(page.getByTestId("workbench-tab-agents")).toHaveAttribute(
    "aria-selected",
    "true",
    { timeout: 10000 },
  );

  // Wait for the agent card to appear
  await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
}

/**
 * Create an agent via direct API POST (no UI interaction).
 * Returns the created agent object (with .id).
 */
async function createAgentViaAPI(page, payload) {
  const resp = await page.request.post(`${BACKEND_URL}/api/workbench/agents`, {
    data: {
      name: payload.name,
      description: payload.description || "",
      system_prompt: payload.systemPrompt || payload.system_prompt || "test",
      tool_names: payload.tool_names || ["csv_ticket_stats"],
      output_schema: payload.output_schema || {},
      requires_input: payload.requires_input || false,
      required_input_description: payload.required_input_description || "",
      show_in_menu: payload.show_in_menu || false,
    },
  });
  return resp.json();
}

/** Delete an agent via direct API DELETE. */
async function deleteAgentViaAPI(page, agentId) {
  await page.request.delete(`${BACKEND_URL}/api/workbench/agents/${agentId}`);
}

// ---------------------------------------------------------------------------
// Agent Fabric UI — Core CRUD & Run
// ---------------------------------------------------------------------------

test.describe("Agent Fabric UI", () => {
  test("creates and deletes an agent", async ({ page }) => {
    const agentName = `e2e-agent-${Date.now()}`;

    await mockEmptyRuns(page);

    // Go to create tab and verify validation
    await goToCreateTab(page);
    await page.getByTestId("workbench-create-agent-button").click();
    await expect(page.getByText("Agent name is required")).toBeVisible();
    await expect(page.getByText("System prompt is required")).toBeVisible();

    // Create agent via UI helper
    await createAgent(page, {
      name: agentName,
      description: "e2e create/delete smoke test",
      systemPrompt: "Use csv_ticket_stats and report the total.",
    });

    // Verify agent card appears on the Agents tab
    const card = page.getByTestId(new RegExp(`^agent-card-`)).filter({ hasText: agentName });
    await expect(card).toBeVisible();

    // Delete from the card
    const deleteBtn = card.locator('[data-testid^="agent-card-delete-"]');
    await deleteBtn.click();

    // Verify card is gone
    await expect(card).toHaveCount(0, { timeout: 10000 });
  });

  test("runs an agent and shows output in runs panel", async ({ page }) => {
    const agentName = `e2e-run-agent-${Date.now()}`;

    // Mock the run endpoint
    await page.route("**/api/workbench/agents/*/runs", async (route) => {
      if (route.request().method() !== "POST") { await route.continue(); return; }
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
    await mockEmptyRuns(page);

    await createAgent(page, {
      name: agentName,
      systemPrompt: "Use csv_ticket_stats and summarize.",
    });

    // Find agent card and click its Run button
    const card = page.getByTestId(new RegExp(`^agent-card-`)).filter({ hasText: agentName });
    await expect(card).toBeVisible();
    const runBtn = card.locator('[data-testid^="agent-card-run-"]');
    await runBtn.click();

    // Verify run appears in the runs side panel
    const runsPanel = page.getByTestId("runs-side-panel");
    await expect(runsPanel).toBeVisible();
    await expect(runsPanel.getByTestId("run-entry-run-e2e-1")).toBeVisible({ timeout: 10000 });

    // The run detail should show the output
    const runDetail = page.getByTestId("run-detail-run-e2e-1");
    await expect(runDetail).toBeVisible({ timeout: 10000 });
    await expect(runDetail).toContainText("Ticket trend summary");

    // Clean up
    const deleteBtn = card.locator('[data-testid^="agent-card-delete-"]');
    await deleteBtn.click();
  });

  test("requires and forwards configured run input", async ({ page }) => {
    const agentName = `e2e-required-input-${Date.now()}`;

    await page.route("**/api/workbench/agents/*/runs", async (route) => {
      if (route.request().method() !== "POST") { await route.continue(); return; }
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
    await mockEmptyRuns(page);

    // Go to create tab, check requires input without description → validation error
    await goToCreateTab(page);
    await page.getByTestId("workbench-agent-name-input").fill(agentName);
    await page
      .getByTestId("workbench-agent-system-prompt-input")
      .fill("Use csv_ticket_stats and summarize.");
    await selectDefaultTool(page);
    await page.getByTestId("workbench-agent-requires-input-checkbox").click();
    await page.getByTestId("workbench-create-agent-button").click();
    await expect(
      page.getByText("Input description is required when input is required"),
    ).toBeVisible();

    // Fill the input description and create
    await page
      .getByTestId("workbench-agent-required-input-description")
      .fill("Ticket INC number");
    await page.getByTestId("workbench-create-agent-button").click();

    // Wait for agents tab and the card
    await expect(page.getByTestId("workbench-tab-agents")).toHaveAttribute(
      "aria-selected", "true", { timeout: 10000 },
    );
    const card = page.getByTestId(new RegExp(`^agent-card-`)).filter({ hasText: agentName });
    await expect(card).toBeVisible({ timeout: 10000 });

    // Click Run — should reveal input field (requires_input agent)
    const runBtn = card.locator('[data-testid^="agent-card-run-"]');
    await runBtn.click();

    // Input field should appear on the card
    const inputField = card.locator("input[placeholder]");
    await expect(inputField).toBeVisible({ timeout: 5000 });

    // Fill input and submit
    await inputField.fill("INC-987654");
    await card.locator("button", { hasText: "Go" }).click();

    // Verify output in runs panel
    const runDetail = page.getByTestId("run-detail-run-e2e-required-1");
    await expect(runDetail).toBeVisible({ timeout: 10000 });
    await expect(runDetail).toContainText("Processed required input: INC-987654");

    // Clean up
    const deleteBtn = card.locator('[data-testid^="agent-card-delete-"]');
    await deleteBtn.click();
  });

  test("creates agent with output schema and tools via suggest button", async ({ page }) => {
    const agentName = `e2e-schema-${Date.now()}`;

    // Mock the suggest-schema endpoint — now returns schema + tool_names
    await page.route("**/api/workbench/suggest-schema", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          schema: {
            type: "object",
            properties: {
              total: { type: "integer", description: "Total ticket count", "x-ui": { widget: "stat-card", label: "Total" } },
              status_breakdown: { type: "object", description: "Count per status", "x-ui": { widget: "pie-chart" } },
            },
          },
          tool_names: ["csv_ticket_stats"],
        }),
      });
    });
    await mockEmptyRuns(page);

    // Navigate to create tab
    await goToCreateTab(page);

    // Fill agent form
    await page.getByTestId("workbench-agent-name-input").fill(agentName);
    await page
      .getByTestId("workbench-agent-system-prompt-input")
      .fill("Analyze ticket stats and report totals.");

    // Verify no tools selected by default
    const statsCheckbox = page.getByTestId("workbench-tool-csv_ticket_stats");
    await expect(statsCheckbox).toBeVisible();
    await expect(statsCheckbox).not.toBeChecked();

    // Click suggest schema & tools
    await page.getByTestId("workbench-suggest-schema-button").click();

    // Wait for schema editor to populate with properties from suggestion
    const editor = page.getByTestId("schema-editor");
    await expect(editor).toBeVisible({ timeout: 5000 });
    await expect(editor.locator('input[value="total"]')).toBeVisible({ timeout: 5000 });

    // Verify tools got auto-selected by the suggestion
    await expect(statsCheckbox).toBeChecked();

    // Other tools should remain unchecked
    const searchCheckbox = page.getByTestId("workbench-tool-csv_search_tickets");
    if (await searchCheckbox.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(searchCheckbox).not.toBeChecked();
    }

    // Create the agent (schema + tools should be included)
    await page.getByTestId("workbench-create-agent-button").click();

    // Should switch to agents tab
    await expect(page.getByTestId("workbench-tab-agents")).toHaveAttribute(
      "aria-selected", "true", { timeout: 10000 },
    );
    const card = page.getByTestId(new RegExp(`^agent-card-`)).filter({ hasText: agentName });
    await expect(card).toBeVisible({ timeout: 10000 });

    // Clean up
    const deleteBtn = card.locator('[data-testid^="agent-card-delete-"]');
    await deleteBtn.click();
    await expect(card).toHaveCount(0, { timeout: 10000 });
  });

  test("handles agent run failure gracefully", async ({ page }) => {
    const agentName = `e2e-fail-agent-${Date.now()}`;

    await page.route("**/api/workbench/agents/*/runs", async (route) => {
      if (route.request().method() !== "POST") { await route.continue(); return; }
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
    await mockEmptyRuns(page);

    await createAgent(page, {
      name: agentName,
      systemPrompt: "Test failure handling",
    });

    const card = page.getByTestId(new RegExp(`^agent-card-`)).filter({ hasText: agentName });
    await expect(card).toBeVisible();
    const runBtn = card.locator('[data-testid^="agent-card-run-"]');
    await runBtn.click();

    // Run entry should appear in the side panel with failed status
    const runsPanel = page.getByTestId("runs-side-panel");
    await expect(runsPanel.getByTestId("run-entry-run-fail-1")).toBeVisible({ timeout: 10000 });
    // Detail should show error message
    const runDetail = page.getByTestId("run-detail-run-fail-1");
    await expect(runDetail).toBeVisible({ timeout: 10000 });
    await expect(runDetail).toContainText("OPENAI_API_KEY not configured");

    // Clean up
    const deleteBtn = card.locator('[data-testid^="agent-card-delete-"]');
    await deleteBtn.click();
  });
});

// ---------------------------------------------------------------------------
// Suggested schema → run → widget verification (LIVE LLM)
// ---------------------------------------------------------------------------

test.describe("Suggest & Widget Rendering (live)", () => {
  test("suggest populates schema and tools, run renders widgets from real output", async ({ page }) => {
    test.setTimeout(120_000);
    const agentName = `e2e-widget-live-${Date.now()}`;

    // Clean up any leftover agents
    const existing = await page.request.get(`${BACKEND_URL}/api/workbench/agents`);
    for (const a of ((await existing.json()).agents || [])) {
      if (a.name.includes("e2e-widget-live")) {
        await page.request.delete(`${BACKEND_URL}/api/workbench/agents/${a.id}`);
      }
    }

    // 1. Create agent — use a prompt that reliably produces structured data
    //    csv_ticket_stats always returns {total, unassigned, by_status, by_priority, by_group}
    //    so the LLM WILL have concrete numbers to put into the schema fields.
    await goToCreateTab(page);
    await page.getByTestId("workbench-agent-name-input").fill(agentName);
    await page.getByTestId("workbench-agent-description-input").fill(
      "Dashboard: Ticket-Statistiken mit Gesamtzahl, Status-Verteilung und Prioritäten"
    );
    await page.getByTestId("workbench-agent-system-prompt-input").fill(
      "Du bist ein Ticket-Dashboard-Agent.\n\n" +
      "1. Rufe csv_ticket_stats auf um die aktuellen Statistiken zu holen.\n" +
      "2. Gib die Ergebnisse EXAKT im vorgegebenen Output-Schema zurück.\n" +
      "3. Das 'message' Feld soll eine Markdown-Zusammenfassung sein mit Überschrift und den wichtigsten Zahlen.\n" +
      "4. total_tickets = die Gesamtanzahl aus den Stats.\n" +
      "5. status_breakdown = das by_status Objekt direkt übernehmen.\n" +
      "6. priority_breakdown = das by_priority Objekt direkt übernehmen.\n\n" +
      "Antworte auf Deutsch. Erfinde KEINE Daten — nutze nur die echten Zahlen aus csv_ticket_stats."
    );

    // Click "Suggest Schema & Tools" — real LLM call
    await page.getByTestId("workbench-suggest-schema-button").click();

    // Wait for suggestion to complete (schema editor populates)
    const editor = page.getByTestId("schema-editor");
    await expect(editor).toBeVisible({ timeout: 30000 });
    await expect(editor.locator('input[value="message"]')).toBeVisible({ timeout: 30000 });

    // Verify csv_ticket_stats was auto-selected (the prompt explicitly uses it)
    const statsCheckbox = page.getByTestId("workbench-tool-csv_ticket_stats");
    await expect(statsCheckbox).toBeChecked({ timeout: 5000 });

    // Take screenshot of populated form
    await page.screenshot({
      path: "test-results/screenshot-suggest-schema-tools.png",
      fullPage: true,
    });

    // Create the agent
    await page.getByTestId("workbench-create-agent-button").click();
    await expect(page.getByTestId("workbench-tab-agents")).toHaveAttribute(
      "aria-selected", "true", { timeout: 10000 },
    );

    // 2. Run the agent — real LLM call with real csv_ticket_stats data
    const card = page.locator('[data-testid^="agent-card-"]').filter({ hasText: agentName });
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.locator('[data-testid^="agent-card-run-"]').click();

    // Wait for run to complete
    const runsPanel = page.getByTestId("runs-side-panel");
    const runEntry = runsPanel.locator('[data-testid^="run-entry-"]').first();
    await expect(runEntry).toBeVisible({ timeout: 60000 });
    await expect(runEntry).toContainText("completed", { timeout: 60000 });

    // Click to show detail
    await runEntry.click();
    const runDetail = runsPanel.locator('[data-testid^="run-detail-"]').first();
    await expect(runDetail).toBeVisible({ timeout: 5000 });

    // 3. Verify the output rendered with actual data
    const renderer = runDetail.getByTestId("schema-renderer");
    await expect(renderer).toBeVisible({ timeout: 10000 });

    // The real CSV has 206 tickets — the output MUST contain this number
    // (csv_ticket_stats returns total:206, and the prompt says to use it)
    await expect(renderer).toContainText("206", { timeout: 5000 });

    // Should also contain status names from the real data
    await expect(renderer).toContainText(/pending|assigned|in_progress/i, { timeout: 5000 });

    // Take screenshot of the rendered result
    await page.screenshot({
      path: "test-results/screenshot-widget-rendering.png",
      fullPage: true,
    });

    // 4. Delete agent
    await card.locator('[data-testid^="agent-card-delete-"]').click();
    await expect(card).not.toBeVisible({ timeout: 10000 });
  });
});

test.describe("Agent Lifecycle (live)", () => {
  test("creates, runs, edits, re-runs, checks history, and deletes an agent", async ({ page }) => {
    test.setTimeout(120_000); // LLM calls can be slow

    const agentName = `e2e-lifecycle-${Date.now()}`;
    const initialPrompt =
      "Suche VPN-bezogene Tickets mit csv_search_tickets. Liste die gefundenen Ticket-IDs und eine kurze Zusammenfassung. Antworte auf Deutsch.";
    const editedPrompt =
      "Nutze csv_search_tickets um Tickets zum Thema 'Outlook' zu finden. Gib die Anzahl und die Ticket-IDs zurück. Antworte auf Deutsch.";

    // Clean up any leftover e2e agents from previous runs
    const existingAgents = await page.request.get(`${BACKEND_URL}/api/workbench/agents`);
    const agentsList = (await existingAgents.json()).agents || [];
    for (const a of agentsList) {
      if (a.name.includes("e2e-lifecycle")) {
        await page.request.delete(`${BACKEND_URL}/api/workbench/agents/${a.id}`);
      }
    }

    // --- 1. Create agent ---
    await createAgent(page, {
      name: agentName,
      description: "E2E lifecycle test — VPN search agent",
      systemPrompt: initialPrompt,
    });

    // Verify agent card is visible
    const card = page.locator(`[data-testid^="agent-card-"]`, { hasText: agentName });
    await expect(card).toBeVisible({ timeout: 10000 });

    // --- 2. Run the agent (first run — VPN search) ---
    const runBtn = card.locator('button', { hasText: "Run" });
    await runBtn.click();

    // Wait for the run to appear in the Runs side panel
    const runsPanel = page.getByTestId("runs-side-panel");
    const runEntries = runsPanel.locator('[data-testid^="run-entry-"]');
    const initialRunCount = await runEntries.count();
    const firstRunEntry = runEntries.first();
    await expect(firstRunEntry).toBeVisible({ timeout: 60000 });
    await expect(firstRunEntry).toContainText("completed", { timeout: 60000 });

    // Click the run entry to see its detail
    await firstRunEntry.click();
    const firstRunDetail = runsPanel.locator('[data-testid^="run-detail-"]').first();
    await expect(firstRunDetail).toBeVisible({ timeout: 5000 });
    // First run should mention VPN-related content
    await expect(firstRunDetail).toContainText(/VPN|vpn|Ticket/i, { timeout: 5000 });

    // --- 3. Edit the agent — change prompt + add requires_input ---
    const editBtn = card.locator('[data-testid^="agent-card-edit-"]');
    await editBtn.click();

    // Wait for edit dialog
    const dialog = page.getByTestId("agent-edit-dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Change system prompt
    const promptField = dialog.getByTestId("edit-agent-system-prompt");
    await promptField.clear();
    await promptField.fill(editedPrompt);

    // Enable requires_input
    const requiresInputCheckbox = dialog.getByTestId("edit-agent-requires-input");
    await requiresInputCheckbox.click();
    const inputDescField = dialog.getByTestId("edit-agent-required-input-desc");
    await expect(inputDescField).toBeVisible();
    await inputDescField.fill("Suchbegriff");

    // Save
    await dialog.getByTestId("edit-agent-save").click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // --- 4. Run the edited agent (second run — Outlook search with input) ---
    // Card should now show an input field when clicking Run
    await page.waitForTimeout(500); // Let card refresh
    const runBtn2 = card.locator('button', { hasText: "Run" });
    await runBtn2.click();

    // Should show input field (requires_input is now true)
    const inputField = card.locator('input[placeholder]');
    await expect(inputField).toBeVisible({ timeout: 5000 });
    await inputField.fill("Outlook");
    await card.locator('button', { hasText: "Go" }).click();

    // Wait for second run to appear (at least one more than after first run)
    await expect(runEntries).toHaveCount(initialRunCount + 2, { timeout: 60000 });

    // The newest run (first in list) should complete
    const secondRunEntry = runEntries.first();
    await expect(secondRunEntry).toContainText("completed", { timeout: 60000 });

    // --- 5. Verify run history — both runs visible with different output ---
    // Click first run (newest = Outlook)
    await secondRunEntry.click();
    const secondRunDetail = runsPanel.locator('[data-testid^="run-detail-"]').first();
    await expect(secondRunDetail).toBeVisible();
    await expect(secondRunDetail).toContainText(/Outlook|outlook|Ticket/i, { timeout: 5000 });

    // Click second run (older = VPN)
    const olderRunEntry = runEntries.nth(1);
    await olderRunEntry.click();
    await page.waitForTimeout(300);
    const olderRunDetail = runsPanel.locator('[data-testid^="run-detail-"]').first();
    await expect(olderRunDetail).toContainText(/VPN|vpn|Ticket/i, { timeout: 5000 });

    // --- 6. Delete the agent ---
    const deleteBtn = card.locator('[data-testid^="agent-card-delete-"]');
    await deleteBtn.click();

    // Agent card should disappear
    await expect(card).not.toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Agent Chat UI (unchanged — tests /agent page, not workbench)
// ---------------------------------------------------------------------------

test.describe("Agent Chat UI", () => {
  test("sends message and displays mocked response", async ({ page }) => {
    await page.route("**/api/agents/run", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result:
            "# Ticket Stats\n\n| Status | Count |\n|--------|-------|\n| Open | 42 |\n| Closed | 18 |",
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

    await input.fill("Show me ticket stats");
    await expect(send).toBeEnabled();
    await send.click();

    await expect(
      page.getByRole("heading", { name: "Ticket Stats" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("csv_ticket_stats")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// SchemaRenderer widgets
// ---------------------------------------------------------------------------

test.describe("SchemaRenderer widgets", () => {
  /**
   * Helper: create agent via API, mock run endpoint, navigate to workbench,
   * click Run on the agent card, and return { card, agentId, renderer } for
   * assertions.  Caller is responsible for cleanup via deleteAgentViaAPI.
   */
  async function setupSchemaTest(page, { agentName, mockRunResponse, outputSchema }) {
    // Create the agent via API so we get a real agentId
    const agent = await createAgentViaAPI(page, {
      name: agentName,
      system_prompt: "schema renderer test",
      output_schema: outputSchema || {},
    });
    const agentId = agent.id;

    // Mock empty runs list first (for initial page load)
    await mockEmptyRuns(page);

    // Mock run endpoint (registered after, so it takes priority for POST to agents/*/runs)
    await page.route("**/api/workbench/agents/*/runs", async (route) => {
      if (route.request().method() !== "POST") { await route.continue(); return; }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...mockRunResponse,
          agent_id: agentId,
          agent_snapshot: {
            ...mockRunResponse.agent_snapshot,
            output_schema: outputSchema || mockRunResponse.agent_snapshot?.output_schema || {},
          },
        }),
      });
    });

    await page.goto(`${APP_URL}/workbench`, { waitUntil: "load" });
    await expect(page.getByTestId("workbench-page-title")).toBeVisible();

    // Find agent card and click Run
    const card = page.getByTestId(`agent-card-${agentId}`);
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.locator(`[data-testid="agent-card-run-${agentId}"]`).click();

    // Wait for run detail to show in the runs panel
    const runDetail = page.getByTestId(`run-detail-${mockRunResponse.id}`);
    await expect(runDetail).toBeVisible({ timeout: 10000 });

    const renderer = runDetail.getByTestId("schema-renderer");
    return { card, agentId, renderer, runDetail };
  }

  test("renders structured output with table, stat-card, and badges", async ({ page }) => {
    const agentName = `e2e-widgets-${Date.now()}`;

    const { agentId, renderer } = await setupSchemaTest(page, {
      agentName,
      mockRunResponse: {
        id: "run-widgets-1",
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
      },
    });

    await expect(renderer).toBeVisible({ timeout: 10000 });

    // Markdown widget (message field)
    await expect(renderer.getByRole("heading", { name: "VPN Connectivity Report" })).toBeVisible();

    // Table widget (affected_users — array of objects)
    await expect(renderer.locator("table")).toBeVisible();
    await expect(renderer.getByText("Alice")).toBeVisible();
    await expect(renderer.getByText("Bob")).toBeVisible();
    await expect(renderer.locator("th", { hasText: "user" })).toBeVisible();

    // Stat-card (total_issues — integer)
    const statField = renderer.getByTestId("schema-field-total_issues");
    await expect(statField).toBeVisible();
    await expect(statField.getByText("3")).toBeVisible();

    // Badge-list (issue_types — array of strings)
    await expect(renderer.getByText("VPN-001")).toBeVisible();
    await expect(renderer.getByText("VPN-003")).toBeVisible();

    await deleteAgentViaAPI(page, agentId);
  });

  test("renders bar-chart and pie-chart from x-ui annotations", async ({ page }) => {
    const agentName = `e2e-charts-${Date.now()}`;
    const outputSchema = {
      type: "object",
      title: "ChartOutput",
      properties: {
        message: { type: "string", "x-ui": { widget: "markdown" } },
        status_distribution: {
          type: "object",
          description: "Tickets per status",
          "x-ui": { widget: "pie-chart" },
        },
        tickets_by_city: {
          type: "array",
          items: {
            type: "object",
            properties: {
              city: { type: "string" },
              count: { type: "integer" },
            },
          },
          "x-ui": { widget: "bar-chart", indexBy: "city", keys: ["count"] },
        },
        total: {
          type: "integer",
          "x-ui": { widget: "stat-card", label: "Total Tickets" },
        },
        ticket_ids: {
          type: "array",
          items: { type: "string" },
          "x-ui": { widget: "badge-list" },
        },
      },
    };

    const { agentId, renderer } = await setupSchemaTest(page, {
      agentName,
      outputSchema,
      mockRunResponse: {
        id: "run-charts-1",
        input_prompt: "show charts",
        status: "completed",
        output: JSON.stringify({
          message: "## Dashboard\n\nTicket statistics overview.",
          status_distribution: { assigned: 43, in_progress: 45, pending: 115 },
          tickets_by_city: [
            { city: "Bern", count: 103 },
            { city: "Zollikofen", count: 26 },
            { city: "Ittigen", count: 20 },
          ],
          total: 206,
          ticket_ids: ["INC-100", "INC-200", "INC-300"],
        }, null, 2),
        agent_snapshot: { tool_names: ["csv_ticket_stats"] },
        tools_used: ["csv_ticket_stats"],
        error: null,
        created_at: "2026-03-04T10:00:00Z",
        completed_at: "2026-03-04T10:00:02Z",
      },
    });

    await expect(renderer).toBeVisible({ timeout: 10000 });

    // Markdown widget
    await expect(renderer.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Stat-card with label
    const statField = renderer.getByTestId("schema-field-total");
    await expect(statField).toBeVisible();
    await expect(statField.getByText("206")).toBeVisible();
    await expect(statField.getByText("Total Tickets").first()).toBeVisible();

    // Badge-list
    await expect(renderer.getByText("INC-100")).toBeVisible();
    await expect(renderer.getByText("INC-300")).toBeVisible();

    // Pie-chart (Nivo renders SVG)
    const pieField = renderer.getByTestId("schema-field-status_distribution");
    await expect(pieField).toBeVisible();
    await expect(pieField.locator("svg")).toBeVisible();

    // Bar-chart (Nivo renders SVG)
    const barField = renderer.getByTestId("schema-field-tickets_by_city");
    await expect(barField).toBeVisible();
    await expect(barField.locator("svg")).toBeVisible();

    await deleteAgentViaAPI(page, agentId);
  });

  test("renders raw JSON for object data (auto-detected)", async ({ page }) => {
    const agentName = `e2e-json-${Date.now()}`;

    const { agentId, renderer } = await setupSchemaTest(page, {
      agentName,
      mockRunResponse: {
        id: "run-json-1",
        input_prompt: "raw",
        status: "completed",
        output: JSON.stringify({
          message: "Here is raw data.",
          metadata: { version: "1.0", source: "csv", processed_at: "2026-03-04" },
        }, null, 2),
        agent_snapshot: { tool_names: ["csv_ticket_stats"] },
        tools_used: ["csv_ticket_stats"],
        error: null,
        created_at: "2026-03-04T10:00:00Z",
        completed_at: "2026-03-04T10:00:01Z",
      },
    });

    await expect(renderer).toBeVisible({ timeout: 10000 });
    await expect(renderer.getByText("Here is raw data.")).toBeVisible();

    // metadata auto-detected as json (object → pre block)
    const metaField = renderer.getByTestId("schema-field-metadata");
    await expect(metaField).toBeVisible();
    await expect(metaField.locator("pre")).toBeVisible();
    await expect(metaField.getByText("csv")).toBeVisible();

    await deleteAgentViaAPI(page, agentId);
  });

  test("falls back gracefully for non-JSON output", async ({ page }) => {
    const agentName = `e2e-fallback-${Date.now()}`;

    const { agentId, renderer } = await setupSchemaTest(page, {
      agentName,
      mockRunResponse: {
        id: "run-fb-1",
        input_prompt: "test",
        status: "completed",
        output: "# Plain Markdown\n\nThis is **not JSON** — just regular markdown.",
        agent_snapshot: { tool_names: ["csv_ticket_stats"] },
        tools_used: ["csv_ticket_stats"],
        error: null,
        created_at: "2026-03-04T10:00:00Z",
        completed_at: "2026-03-04T10:00:01Z",
      },
    });

    await expect(renderer).toBeVisible({ timeout: 10000 });

    // Non-JSON falls back: wrapped as {message: raw_text} → markdown
    await expect(renderer.getByRole("heading", { name: "Plain Markdown" })).toBeVisible();
    await expect(renderer.getByText("not JSON")).toBeVisible();

    await deleteAgentViaAPI(page, agentId);
  });

  test("runs VPN troubleshooting agent and verifies structured output", async ({ page }) => {
    const agentName = `e2e-vpn-agent-${Date.now()}`;

    const { agentId, renderer, runDetail } = await setupSchemaTest(page, {
      agentName,
      mockRunResponse: {
        id: "run-vpn-1",
        input_prompt: "Finde alle VPN-bezogenen Tickets",
        status: "completed",
        output: JSON.stringify({
          message:
            "## VPN-Probleme Analyse\n\nEs wurden **4 VPN-bezogene Tickets** gefunden:\n\n| Ticket | Problem | Status |\n|--------|---------|--------|\n| INC-101 | VPN deaktivieren | assigned |\n| INC-205 | MS-VPN verbindet nicht | in_progress |\n| INC-312 | VPN Slowdown Evenings | pending |\n| INC-401 | VPN im Homeoffice nicht vorhanden | assigned |\n\n**Empfehlung:** Die meisten VPN-Probleme betreffen die Abendstunden und Homeoffice-Verbindungen.",
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
      },
    });

    // Verify output in runs panel
    await expect(runDetail).toContainText("VPN", { timeout: 10000 });
    await expect(runDetail).toContainText("INC-101");
    await expect(runDetail).toContainText("INC-312");

    // SchemaRenderer visible with referenced ticket badges
    await expect(renderer).toBeVisible();
    await expect(page.locator("span").filter({ hasText: "INC-401" })).toBeVisible();

    await deleteAgentViaAPI(page, agentId);
  });
});

// ---------------------------------------------------------------------------
// Show in Menu
// ---------------------------------------------------------------------------

test.describe("Show in Menu", () => {
  test("agent with show_in_menu appears as a tab and runs from its own page", async ({ page }) => {
    const agentName = `e2e-menu-agent-${Date.now()}`;

    // Create an agent with show_in_menu=true via API
    const createdAgent = await createAgentViaAPI(page, {
      name: agentName,
      description: "A menu agent for E2E testing",
      system_prompt: "Use csv_ticket_stats and report the total.",
      tool_names: ["csv_ticket_stats"],
      show_in_menu: true,
    });
    const agentId = createdAgent.id;

    // Mock the run endpoint
    await page.route("**/api/workbench/agents/*/runs", async (route) => {
      if (route.request().method() !== "POST") { await route.continue(); return; }
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "run-menu-1",
          agent_id: agentId,
          input_prompt: body?.input_prompt || "",
          status: "completed",
          output: JSON.stringify({
            message: "## Stats Report\n\nTotal: 206 tickets.",
            referenced_tickets: [],
          }, null, 2),
          agent_snapshot: { tool_names: ["csv_ticket_stats"] },
          tools_used: ["csv_ticket_stats"],
          error: null,
          created_at: "2026-03-04T10:00:00Z",
          completed_at: "2026-03-04T10:00:01Z",
        }),
      });
    });

    // Load the app — the agent should appear as a tab
    await page.goto(`${APP_URL}/csvtickets`, { waitUntil: "load" });

    // Find the menu tab for our agent
    const agentTab = page.getByTestId(`tab-agent-menu-${agentId}`);
    await expect(agentTab).toBeVisible({ timeout: 10000 });
    await expect(agentTab).toContainText(agentName);

    // Click the tab — navigates to the agent run page
    await agentTab.click();
    await expect(page.getByTestId("agent-run-page-title")).toContainText(agentName);
    await expect(page.getByText("A menu agent for E2E testing")).toBeVisible();

    // Run the agent from its own page
    await page.getByTestId("agent-run-button").click();

    // Verify output renders
    const output = page.getByTestId("agent-run-output");
    await expect(output).toBeVisible({ timeout: 10000 });
    await expect(
      output.getByRole("heading", { name: "Stats Report" }),
    ).toBeVisible();

    // Clean up
    await deleteAgentViaAPI(page, agentId);
  });
});
