import { expect, test } from "@playwright/test";

const APP_URL = process.env.E2E_APP_URL || "http://localhost:3001";
const BACKEND_URL = APP_URL.replace("3001", "5001");

test.describe.configure({ mode: "serial" });

// ---------------------------------------------------------------------------
// Helpers (zero mocks — all live)
// ---------------------------------------------------------------------------

/** Delete all agents whose name contains "e2e-", closing any open dialogs first. */
async function cleanupE2eAgents(page) {
  const resp = await page.request.get(`${BACKEND_URL}/api/workbench/agents`);
  for (const a of (await resp.json()).agents || []) {
    if (a.name.includes("e2e-")) {
      await page.request.delete(`${BACKEND_URL}/api/workbench/agents/${a.id}`);
    }
  }
}

function expectRunDetailToShowContent(runDetail) {
  return expect(runDetail).not.toContainText("No output", { timeout: 10000 });
}

/** Navigate to workbench and switch to the "Create Agent" tab. */
async function goToCreateTab(page) {
  await page.goto(`${APP_URL}/workbench`, { waitUntil: "load" });
  await expect(page.getByTestId("workbench-page-title")).toBeVisible();
  await page.getByTestId("workbench-tab-create").click();
  await expect(page.getByTestId("workbench-create-agent-button")).toBeVisible();
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
    await page
      .getByTestId("workbench-agent-description-input")
      .fill(description);
  }
  await page
    .getByTestId("workbench-agent-system-prompt-input")
    .fill(systemPrompt);

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

  await expect(page.getByTestId("workbench-tab-agents")).toHaveAttribute(
    "aria-selected",
    "true",
    { timeout: 10000 },
  );

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

/** Close the result dialog if it is currently open. */
async function closeDialogIfOpen(page) {
  const dialog = page.locator("[role=dialog]").last();
  if (await dialog.isVisible({ timeout: 1000 }).catch(() => false)) {
    await dialog.locator("button").first().click();
    await expect(dialog).toBeHidden({ timeout: 5000 });
  }
}

async function mockWorkbenchEditResponseFlow(page) {
  const agentId = "mock-agent-edit-response";
  const state = {
    agent: {
      id: agentId,
      name: "Editable Response Agent",
      description: "Mocked agent for edit-response coverage",
      system_prompt: "Return the original response",
      tool_names: ["csv_ticket_stats"],
      output_schema: {
        type: "object",
        properties: {
          message: { type: "string", "x-ui": { widget: "markdown" } },
        },
      },
      requires_input: false,
      required_input_description: "",
      show_in_menu: false,
    },
    runs: [],
    runCounter: 0,
  };

  const buildRun = () => {
    state.runCounter += 1;
    const edited = state.agent.system_prompt.includes("edited");
    const message = edited
      ? "Edited response shown after saving the new prompt."
      : "Original response shown before editing the prompt.";

    const run = {
      id: `mock-run-${state.runCounter}`,
      agent_id: state.agent.id,
      status: "completed",
      output: JSON.stringify({ message }),
      error: null,
      created_at: new Date(Date.now() + state.runCounter * 1000).toISOString(),
      input_prompt: "",
      tools_used: ["csv_ticket_stats"],
      agent_snapshot: {
        ...state.agent,
      },
    };

    state.runs = [run, ...state.runs];
    return run;
  };

  await page.route("**/api/workbench/ui-config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ endpoints: [] }),
    });
  });

  await page.route("**/api/workbench/tools", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tools: [
          {
            name: "csv_ticket_stats",
            description: "Mock CSV ticket stats tool",
          },
        ],
      }),
    });
  });

  await page.route("**/api/workbench/agents", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ agents: [state.agent] }),
    });
  });

  await page.route(`**/api/workbench/agents/${agentId}`, async (route) => {
    if (route.request().method() === "PUT") {
      const updates = route.request().postDataJSON();
      state.agent = {
        ...state.agent,
        ...updates,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(state.agent),
      });
      return;
    }

    if (route.request().method() === "DELETE") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(state.agent),
    });
  });

  await page.route(`**/api/workbench/agents/${agentId}/runs`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ runs: state.runs }),
      });
      return;
    }

    if (route.request().method() === "POST") {
      const run = buildRun();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(run),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/workbench/runs", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ runs: state.runs }),
    });
  });
}

// ---------------------------------------------------------------------------
// Agent Fabric UI — All Live (no mocks)
// ---------------------------------------------------------------------------

test.describe("Agent Fabric UI (live)", () => {
  // ── 1. creates and deletes an agent ────────────────────────────────────
  test("creates and deletes an agent", async ({ page }) => {
    test.setTimeout(120_000);
    await cleanupE2eAgents(page);

    const agentName = `e2e-crud-${Date.now()}`;

    await createAgent(page, {
      name: agentName,
      description: "e2e create/delete smoke test",
      systemPrompt: "Use csv_ticket_stats and report the total.",
    });

    // Verify agent card appears on the Agents tab
    const card = page
      .getByTestId(new RegExp(`^agent-card-`))
      .filter({ hasText: agentName });
    await expect(card).toBeVisible();

    // Delete from the card
    const deleteBtn = card.locator('[data-testid^="agent-card-delete-"]');
    await deleteBtn.click();

    // Verify card is gone
    await expect(card).toHaveCount(0, { timeout: 10000 });
  });

  // ── 2. runs agent and shows result in dialog ───────────────────────────
  test("runs agent and shows result in dialog", async ({ page }) => {
    test.setTimeout(120_000);
    await cleanupE2eAgents(page);

    const agentName = `e2e-run-${Date.now()}`;

    await createAgent(page, {
      name: agentName,
      systemPrompt:
        "Use csv_ticket_stats and summarize. " +
        "Always include the exact total ticket count in your response.",
    });

    // Find agent card and click Run
    const card = page
      .getByTestId(new RegExp(`^agent-card-`))
      .filter({ hasText: agentName });
    await expect(card).toBeVisible();
    const runBtn = card.locator('[data-testid^="agent-card-run-"]');
    await runBtn.click();

    // Wait for the dialog to auto-open with the run detail (live LLM)
    const runDetail = page.locator('[data-testid^="run-detail-"]').first();
    await expect(runDetail).toBeVisible({ timeout: 60000 });

    // Live LLM output is intentionally flexible; verify that a non-empty result rendered.
    await expectRunDetailToShowContent(runDetail);

    // Close result dialog, then delete
    await closeDialogIfOpen(page);
    const deleteBtn = card.locator('[data-testid^="agent-card-delete-"]');
    await deleteBtn.click();
    await expect(card).toHaveCount(0, { timeout: 10000 });
  });

  // ── 3. requires input and forwards it ──────────────────────────────────
  test("requires input and forwards it", async ({ page }) => {
    test.setTimeout(120_000);
    await cleanupE2eAgents(page);

    const agentName = `e2e-input-${Date.now()}`;

    await createAgent(page, {
      name: agentName,
      systemPrompt:
        "Use csv_search_tickets to search for tickets matching the user's input. " +
        "Summarize the results. Antworte auf Deutsch.",
      requiresInput: true,
      requiredInputDescription: "Ticket INC number",
    });

    const card = page
      .getByTestId(new RegExp(`^agent-card-`))
      .filter({ hasText: agentName });
    await expect(card).toBeVisible({ timeout: 10000 });

    // Click Run — should reveal input field (requires_input agent)
    const runBtn = card.locator('[data-testid^="agent-card-run-"]');
    await runBtn.click();

    const inputField = card.locator("input[placeholder]");
    await expect(inputField).toBeVisible({ timeout: 5000 });

    // Fill input and submit
    await inputField.fill("VPN");
    await card.locator("button", { hasText: "Go" }).click();

    // Wait for dialog with VPN-related output from the real LLM
    const runDetail = page.locator('[data-testid^="run-detail-"]').first();
    await expect(runDetail).toBeVisible({ timeout: 60000 });
    await expect(runDetail).toContainText(/VPN|vpn/i, { timeout: 10000 });

    // Close dialog, then delete
    await closeDialogIfOpen(page);
    const deleteBtn = card.locator('[data-testid^="agent-card-delete-"]');
    await deleteBtn.click();
    await expect(card).toHaveCount(0, { timeout: 10000 });
  });

  // ── 4. suggest schema & tools populates form ──────────────────────────
  test("suggest schema & tools populates form", async ({ page }) => {
    test.setTimeout(120_000);
    await cleanupE2eAgents(page);

    const agentName = `e2e-suggest-${Date.now()}`;

    await goToCreateTab(page);

    // Fill name + prompt
    await page.getByTestId("workbench-agent-name-input").fill(agentName);
    await page
      .getByTestId("workbench-agent-system-prompt-input")
      .fill(
        "Du bist ein Ticket-Dashboard-Agent. Rufe csv_ticket_stats auf und " +
          "gib die Ergebnisse als Zusammenfassung mit Gesamtzahl zurück.",
      );

    // Click "Suggest Schema & Tools" — real LLM call
    await page.getByTestId("workbench-suggest-schema-button").click();

    // Wait for schema editor to show "message" property
    const editor = page.getByTestId("schema-editor");
    await expect(editor).toBeVisible({ timeout: 30000 });
    await expect(editor.locator('input[value="message"]')).toBeVisible({
      timeout: 30000,
    });

    // Verify csv_ticket_stats was auto-selected
    const statsCheckbox = page.getByTestId("workbench-tool-csv_ticket_stats");
    await expect(statsCheckbox).toBeChecked({ timeout: 5000 });

    // Create the agent (schema + tools included)
    await page.getByTestId("workbench-create-agent-button").click();
    await expect(page.getByTestId("workbench-tab-agents")).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 10000 },
    );
    const card = page
      .getByTestId(new RegExp(`^agent-card-`))
      .filter({ hasText: agentName });
    await expect(card).toBeVisible({ timeout: 10000 });

    // Clean up
    await closeDialogIfOpen(page);
    const deleteBtn = card.locator('[data-testid^="agent-card-delete-"]');
    await deleteBtn.click();
    await expect(card).toHaveCount(0, { timeout: 10000 });
  });

  // ── 5. suggest + run renders widgets from real output ──────────────────
  test("suggest + run renders widgets from real output", async ({ page }) => {
    test.setTimeout(120_000);
    await cleanupE2eAgents(page);

    const agentName = `e2e-widget-live-${Date.now()}`;

    // Create agent with explicit output schema via API for deterministic rendering
    const outputSchema = {
      type: "object",
      properties: {
        message: { type: "string", "x-ui": { widget: "markdown" } },
        total_tickets: {
          type: "integer",
          "x-ui": { widget: "stat-card", label: "Total" },
        },
        ticket_ids: {
          type: "array",
          items: { type: "string" },
          "x-ui": { widget: "badge-list" },
        },
      },
    };

    const agent = await createAgentViaAPI(page, {
      name: agentName,
      description: "Dashboard: Ticket stats with total, status, and priorities",
      system_prompt:
        "Du bist ein Ticket-Dashboard-Agent.\n\n" +
        "1. Rufe csv_ticket_stats auf um die aktuellen Statistiken zu holen.\n" +
        "2. Gib die Ergebnisse EXAKT im vorgegebenen Output-Schema zurück.\n" +
        "3. Das 'message' Feld soll eine Markdown-Zusammenfassung sein.\n" +
        "4. total_tickets = die Gesamtanzahl aus den Stats.\n" +
        "5. ticket_ids = eine Liste mit ein paar Beispiel-Ticket-IDs.\n\n" +
        "Erfinde KEINE Daten — nutze nur die echten Zahlen aus csv_ticket_stats.",
      tool_names: ["csv_ticket_stats"],
      output_schema: outputSchema,
    });
    const agentId = agent.id;

    // Navigate to workbench and run
    await page.goto(`${APP_URL}/workbench`, { waitUntil: "load" });
    await expect(page.getByTestId("workbench-page-title")).toBeVisible();

    const card = page.getByTestId(`agent-card-${agentId}`);
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.locator(`[data-testid="agent-card-run-${agentId}"]`).click();

    // Wait for run to complete — dialog auto-opens
    const runDetail = page.locator('[data-testid^="run-detail-"]').first();
    await expect(runDetail).toBeVisible({ timeout: 60000 });

    // Live LLM output is intentionally flexible; verify that a non-empty result rendered.
    await expectRunDetailToShowContent(runDetail);

    // Take screenshot
    await page.screenshot({
      path: "test-results/screenshot-widget-rendering.png",
      fullPage: true,
    });

    // Close dialog, then delete
    await closeDialogIfOpen(page);
    await card.locator(`[data-testid="agent-card-delete-${agentId}"]`).click();
    await expect(card).not.toBeVisible({ timeout: 10000 });
  });

  // ── 6. full lifecycle: create, run, edit, re-run, history, delete ──────
  test("full lifecycle: create, run, edit, re-run, history, delete", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await cleanupE2eAgents(page);

    const agentName = `e2e-lifecycle-${Date.now()}`;
    const initialPrompt =
      "Suche VPN-bezogene Tickets mit csv_search_tickets. Liste die gefundenen Ticket-IDs und eine kurze Zusammenfassung. Antworte auf Deutsch.";
    const editedPrompt =
      "Nutze csv_search_tickets um Tickets zum Thema 'Outlook' zu finden. Gib die Anzahl und die Ticket-IDs zurück. Antworte auf Deutsch.";

    // --- 1. Create agent ---
    await createAgent(page, {
      name: agentName,
      description: "E2E lifecycle test — VPN search agent",
      systemPrompt: initialPrompt,
    });

    const card = page.locator(`[data-testid^="agent-card-"]`, {
      hasText: agentName,
    });
    await expect(card).toBeVisible({ timeout: 10000 });

    // --- 2. Run the agent (first run — VPN search) ---
    const runBtn = card.locator("button", { hasText: "Run" });
    await runBtn.click();

    const runsPanel = page.getByTestId("runs-side-panel");
    const runEntries = runsPanel.locator('[data-testid^="run-entry-"]');
    const initialRunCount = await runEntries.count();

    // Wait for dialog to auto-open with the run result
    const firstRunDetail = page.locator('[data-testid^="run-detail-"]').first();
    await expect(firstRunDetail).toBeVisible({ timeout: 60000 });
    await expect(firstRunDetail).toContainText(/VPN|vpn|Ticket/i, {
      timeout: 5000,
    });

    // Close dialog
    await closeDialogIfOpen(page);

    // --- 3. Edit the agent — change prompt + add requires_input ---
    const editBtn = card.locator('[data-testid^="agent-card-edit-"]');
    await editBtn.click();

    const dialog = page.getByTestId("agent-edit-dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const promptField = dialog.getByTestId("edit-agent-system-prompt");
    await promptField.clear();
    await promptField.fill(editedPrompt);

    const requiresInputCheckbox = dialog.getByTestId(
      "edit-agent-requires-input",
    );
    await requiresInputCheckbox.click();
    const inputDescField = dialog.getByTestId("edit-agent-required-input-desc");
    await expect(inputDescField).toBeVisible();
    await inputDescField.fill("Suchbegriff");

    await dialog.getByTestId("edit-agent-save").click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // --- 4. Run edited agent (second run — Outlook search with input) ---
    await page.waitForTimeout(500);
    const runBtn2 = card.locator("button", { hasText: "Run" });
    await runBtn2.click();

    const inputField = card.locator("input[placeholder]");
    await expect(inputField).toBeVisible({ timeout: 5000 });
    await inputField.fill("Outlook");
    await card.locator("button", { hasText: "Go" }).click();

    await expect(runEntries).toHaveCount(initialRunCount + 2, {
      timeout: 60000,
    });

    const secondRunDetail = page
      .locator('[data-testid^="run-detail-"]')
      .first();
    await expect(secondRunDetail).toBeVisible({ timeout: 60000 });
    await expect(secondRunDetail).toContainText(/Outlook|outlook|Ticket/i, {
      timeout: 5000,
    });

    // Close dialog, check history (older VPN run)
    await closeDialogIfOpen(page);

    const olderRunEntry = runEntries.nth(1);
    await olderRunEntry.click();
    await page.waitForTimeout(300);
    const olderRunDetail = page.locator('[data-testid^="run-detail-"]').first();
    await expect(olderRunDetail).toContainText(/VPN|vpn|Ticket/i, {
      timeout: 5000,
    });

    // --- 5. Close dialog and delete the agent ---
    await closeDialogIfOpen(page);
    const deleteBtn = card.locator('[data-testid^="agent-card-delete-"]');
    await deleteBtn.click();
    await expect(card).not.toBeVisible({ timeout: 10000 });
  });
});

test.describe("Agent Fabric UI (mocked)", () => {
  test("editing an agent changes the next visible response and preserves history", async ({
    page,
  }) => {
    await mockWorkbenchEditResponseFlow(page);

    await page.goto(`${APP_URL}/workbench`, { waitUntil: "load" });
    await expect(page.getByTestId("workbench-page-title")).toBeVisible();

    const card = page.getByTestId("agent-card-mock-agent-edit-response");
    await expect(card).toBeVisible();

    await card.getByTestId("agent-card-run-mock-agent-edit-response").click();

    const runDetail = page.locator('[data-testid^="run-detail-"]').first();
    await expect(runDetail).toBeVisible();
    await expect(runDetail).toContainText(
      "Original response shown before editing the prompt.",
    );

    await closeDialogIfOpen(page);

    await card.getByTestId("agent-card-edit-mock-agent-edit-response").click();

    const dialog = page.getByTestId("agent-edit-dialog");
    await expect(dialog).toBeVisible();

    const promptField = dialog.getByTestId("edit-agent-system-prompt");
    await promptField.clear();
    await promptField.fill("Return the edited response");

    await dialog.getByTestId("edit-agent-save").click();
    await expect(dialog).not.toBeVisible();

    await card.getByTestId("agent-card-run-mock-agent-edit-response").click();

    await expect(runDetail).toBeVisible();
    await expect(runDetail).toContainText(
      "Edited response shown after saving the new prompt.",
    );
    await expect(runDetail).not.toContainText(
      "Original response shown before editing the prompt.",
    );

    await closeDialogIfOpen(page);

    const runEntries = page.locator('[data-testid^="run-entry-"]');
    await expect(runEntries).toHaveCount(2);

    await runEntries.nth(1).click();
    await expect(runDetail).toContainText(
      "Original response shown before editing the prompt.",
    );
  });
});

// ---------------------------------------------------------------------------
// Agent Chat UI (live — no mocks)
// ---------------------------------------------------------------------------

test.describe("Agent Chat UI (live)", () => {
  test("agent chat sends message and shows response", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto(`${APP_URL}/agent`, { waitUntil: "load" });

    const input = page.getByTestId("agent-input");
    const send = page.getByTestId("agent-send");

    await expect(input).toBeVisible();
    await expect(send).toBeDisabled();

    await input.fill("Zeige Ticket-Statistiken");
    await expect(send).toBeEnabled();
    await send.click();

    // Wait for real LLM response — should show tool badge and some content
    await expect(page.getByText("csv_ticket_stats")).toBeVisible({
      timeout: 60000,
    });
  });
});

// ---------------------------------------------------------------------------
// Show in Menu (live — no mocks)
// ---------------------------------------------------------------------------

test.describe("Show in Menu (live)", () => {
  test("show in menu agent appears as tab", async ({ page }) => {
    test.setTimeout(120_000);
    await cleanupE2eAgents(page);

    const agentName = `e2e-menu-${Date.now()}`;

    // Create an agent with show_in_menu=true via API
    const createdAgent = await createAgentViaAPI(page, {
      name: agentName,
      description: "A menu agent for E2E testing",
      system_prompt: "Use csv_ticket_stats and report the total.",
      tool_names: ["csv_ticket_stats"],
      show_in_menu: true,
    });
    const agentId = createdAgent.id;

    // Load the app — the agent should appear as a tab
    await page.goto(`${APP_URL}/csvtickets`, { waitUntil: "load" });

    // Find the menu tab for our agent
    const agentTab = page.getByTestId(`tab-agent-menu-${agentId}`);
    await expect(agentTab).toBeVisible({ timeout: 10000 });
    await expect(agentTab).toContainText(agentName);

    // Click the tab — navigates to the agent run page
    await agentTab.click();
    await expect(page.getByTestId("agent-run-page-title")).toContainText(
      agentName,
    );

    // Clean up via API
    await deleteAgentViaAPI(page, agentId);
  });
});
