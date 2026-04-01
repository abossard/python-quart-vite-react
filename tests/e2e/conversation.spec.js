import { expect, test } from "@playwright/test";

const APP_URL = process.env.E2E_APP_URL || "http://localhost:3001";
const BACKEND_URL = APP_URL.replace("3001", "5001");

test.describe.configure({ mode: "serial" });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Delete all agents whose name contains "e2e-conv-" via API. */
async function cleanupE2eConvAgents(page) {
  const resp = await page.request.get(`${BACKEND_URL}/api/workbench/agents`);
  for (const a of (await resp.json()).agents || []) {
    if (a.name.includes("e2e-conv-")) {
      // Delete threads for this agent first
      const threadsResp = await page.request.get(
        `${BACKEND_URL}/api/workbench/threads?agent_id=${a.id}`,
      );
      for (const t of (await threadsResp.json()).threads || []) {
        await page.request.delete(
          `${BACKEND_URL}/api/workbench/threads/${t.id}`,
        );
      }
      await page.request.delete(
        `${BACKEND_URL}/api/workbench/agents/${a.id}`,
      );
    }
  }
}

/** Create agent via API for conversation tests. */
async function createConvAgentViaAPI(page, name) {
  const resp = await page.request.post(`${BACKEND_URL}/api/workbench/agents`, {
    data: {
      name,
      description: "E2E conversation test agent",
      system_prompt:
        "Use csv_ticket_stats and report the total number of tickets. " +
        "Keep your response short — one or two sentences.",
      tool_names: ["csv_ticket_stats"],
      output_schema: {},
      requires_input: false,
      required_input_description: "",
      show_in_menu: false,
    },
  });
  return resp.json();
}

/** Close any open dialog. */
async function closeDialogIfOpen(page) {
  const dialog = page.locator("[role=dialog]").last();
  if (await dialog.isVisible({ timeout: 1000 }).catch(() => false)) {
    await dialog.locator("button").first().click();
    await expect(dialog).toBeHidden({ timeout: 5000 });
  }
}

// ---------------------------------------------------------------------------
// AG-UI Conversation Tests (mocked backend — fast, deterministic)
// ---------------------------------------------------------------------------

test.describe("Conversation Panel (mocked)", () => {
  /**
   * Mock the AG-UI endpoint to return a deterministic SSE stream.
   * This avoids needing a real LLM for conversation tests.
   */
  async function mockAgUiEndpoint(page, { threadId = "mock-thread-1" } = {}) {
    const agent = {
      id: "mock-conv-agent",
      name: "Mock Conv Agent",
      description: "Mocked for conversation tests",
      system_prompt: "test",
      tool_names: ["csv_ticket_stats"],
      output_schema: {},
      requires_input: false,
      required_input_description: "",
      show_in_menu: false,
      model: "",
      temperature: 0,
      recursion_limit: 3,
      max_tokens: 4096,
      reasoning_effort: "low",
      output_instructions: "",
      tool_names_json: '["csv_ticket_stats"]',
      success_criteria: [],
    };

    // Mock workbench config endpoints
    await page.route("**/api/workbench/ui-config", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ endpoints: [], llm: {} }),
      });
    });

    await page.route("**/api/workbench/tools", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tools: [{ name: "csv_ticket_stats", description: "Get ticket stats" }],
        }),
      });
    });

    await page.route("**/api/workbench/agents", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ agents: [agent] }),
        });
        return;
      }
      await route.fallback();
    });

    await page.route("**/api/workbench/runs", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ runs: [] }),
        });
        return;
      }
      await route.fallback();
    });

    await page.route("**/api/workbench/threads**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ threads: [] }),
        });
        return;
      }
      await route.fallback();
    });

    // Mock AG-UI SSE endpoint — return deterministic events
    await page.route("**/api/workbench/ag-ui", async (route) => {
      const body = route.request().postDataJSON();
      const runId = "mock-run-1";
      const msgId = "mock-msg-1";
      const tcId = "mock-tc-1";

      const events = [
        { type: "RUN_STARTED", threadId, runId },
        {
          type: "STATE_SNAPSHOT",
          snapshot: { agent_id: "mock-conv-agent", agent_name: "Mock Conv Agent", tools: ["csv_ticket_stats"] },
        },
        { type: "STEP_STARTED", stepName: "agent_execution" },
        { type: "TOOL_CALL_START", toolCallId: tcId, toolCallName: "csv_ticket_stats" },
        { type: "TOOL_CALL_ARGS", toolCallId: tcId, delta: '{"query": "stats"}' },
        { type: "TOOL_CALL_END", toolCallId: tcId },
        {
          type: "TOOL_CALL_RESULT",
          messageId: "mock-tr-1",
          toolCallId: tcId,
          content: "Total: 150 tickets",
          role: "tool",
        },
        { type: "TEXT_MESSAGE_START", messageId: msgId, role: "assistant" },
        {
          type: "TEXT_MESSAGE_CONTENT",
          messageId: msgId,
          delta: "There are **150 tickets** in total. ",
        },
        {
          type: "TEXT_MESSAGE_CONTENT",
          messageId: msgId,
          delta: `Your message was: "${body?.message || ""}"`,
        },
        { type: "TEXT_MESSAGE_END", messageId: msgId },
        { type: "STEP_FINISHED", stepName: "agent_execution" },
        { type: "RUN_FINISHED", threadId, runId },
      ];

      const sseBody = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");

      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        body: sseBody,
      });
    });
  }

  test("clicking completed run opens conversation modal with result and chat input", async ({ page }) => {
    await mockAgUiEndpoint(page);

    // Mock a completed run
    await page.route("**/api/workbench/runs", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            runs: [{
              id: "mock-completed-run",
              agent_id: "mock-conv-agent",
              status: "completed",
              output: '{"message": "Test output with **150 tickets**"}',
              error: null,
              created_at: new Date().toISOString(),
              input_prompt: "show me stats",
              tools_used: ["csv_ticket_stats"],
              agent_snapshot: { name: "Mock Conv Agent" },
            }],
          }),
        });
        return;
      }
      await route.fallback();
    });

    // Mock thread-from-run API (for follow-up chat)
    await page.route("**/api/workbench/threads/from-run/**", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-thread-from-run",
          agent_id: "mock-conv-agent",
          title: "Chat from run",
          messages: [],
        }),
      });
    });

    await page.goto(`${APP_URL}/workbench`, { waitUntil: "load" });
    await expect(page.getByTestId("workbench-page-title")).toBeVisible();

    // Click on the completed run in the side panel
    const runEntry = page.getByTestId("run-entry-mock-completed-run");
    await expect(runEntry).toBeVisible({ timeout: 5000 });
    await runEntry.click();

    // Conversation modal should open with messages
    const messages = page.getByTestId("run-conversation-messages");
    await expect(messages).toBeVisible({ timeout: 5000 });

    // User message from run input should appear
    await expect(page.getByTestId("chat-message-user")).toContainText("show me stats");

    // Tool calls should appear
    await expect(page.getByTestId("chat-message-tool")).toBeVisible();

    // Structured output should be rendered (not raw JSON)
    await expect(page.getByTestId("chat-message-structured")).toBeVisible();

    // Follow-up chat input should be available
    await expect(page.getByTestId("conversation-input")).toBeVisible();
    await expect(page.getByTestId("conversation-send")).toBeVisible();
  });

  test("running run shows status bar, completed run shows chat input", async ({ page }) => {
    await mockAgUiEndpoint(page);

    await page.route("**/api/workbench/runs", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            runs: [
              {
                id: "mock-running-run",
                agent_id: "mock-conv-agent",
                status: "running",
                output: null,
                error: null,
                created_at: new Date().toISOString(),
                input_prompt: "still running",
                tools_used: [],
                agent_snapshot: { name: "Mock Conv Agent" },
              },
              {
                id: "mock-done-run",
                agent_id: "mock-conv-agent",
                status: "completed",
                output: "Done output",
                error: null,
                created_at: new Date(Date.now() - 60000).toISOString(),
                input_prompt: "done",
                tools_used: ["csv_ticket_stats"],
                agent_snapshot: { name: "Mock Conv Agent" },
              },
            ],
          }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto(`${APP_URL}/workbench`, { waitUntil: "load" });
    await expect(page.getByTestId("workbench-page-title")).toBeVisible();

    // Click the running run — should show running status, no chat input
    await page.getByTestId("run-entry-mock-running-run").click();
    await expect(page.getByTestId("run-status-running")).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("conversation-input")).not.toBeVisible();

    // Close modal
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('button').first().click();
    await page.waitForTimeout(300);

    // Click the completed run — should show chat input, no running status
    await page.getByTestId("run-entry-mock-done-run").click();
    await expect(page.getByTestId("conversation-input")).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("run-status-running")).not.toBeVisible();
  });

  test("closing modal keeps runs panel visible", async ({ page }) => {
    await mockAgUiEndpoint(page);

    await page.route("**/api/workbench/runs", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            runs: [{
              id: "mock-close-test-run",
              agent_id: "mock-conv-agent",
              status: "completed",
              output: "test output",
              error: null,
              created_at: new Date().toISOString(),
              input_prompt: "test",
              tools_used: [],
              agent_snapshot: { name: "Mock Conv Agent" },
            }],
          }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto(`${APP_URL}/workbench`, { waitUntil: "load" });
    await expect(page.getByTestId("workbench-page-title")).toBeVisible();
    await expect(page.getByTestId("runs-side-panel")).toBeVisible();

    // Open run modal
    await page.getByTestId("run-entry-mock-close-test-run").click();
    await expect(page.getByTestId("run-conversation-messages")).toBeVisible({ timeout: 3000 });

    // Close modal — runs panel still visible
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('button').first().click();
    await expect(page.getByTestId("runs-side-panel")).toBeVisible({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// AG-UI Conversation API Tests (live backend, no LLM needed)
// ---------------------------------------------------------------------------

test.describe("Thread API (live backend)", () => {
  test("creates thread, adds messages, retrieves them", async ({ page }) => {
    await cleanupE2eConvAgents(page);

    const agentName = `e2e-conv-thread-api-${Date.now()}`;
    const agent = await createConvAgentViaAPI(page, agentName);

    // Create thread via API
    const createResp = await page.request.post(
      `${BACKEND_URL}/api/workbench/threads/from-run/nonexistent`,
    );
    // This should fail — run doesn't exist
    expect(createResp.status()).toBeGreaterThanOrEqual(400);

    // Create a real run first
    const runResp = await page.request.post(
      `${BACKEND_URL}/api/workbench/agents/${agent.id}/runs`,
      { data: { input_prompt: "test thread api", required_input_value: "" } },
    );
    expect(runResp.ok()).toBeTruthy();

    // List threads — should be empty for this agent
    const listResp = await page.request.get(
      `${BACKEND_URL}/api/workbench/threads?agent_id=${agent.id}`,
    );
    const threadsData = await listResp.json();
    expect(threadsData.threads).toBeDefined();

    // Clean up
    await page.request.delete(
      `${BACKEND_URL}/api/workbench/agents/${agent.id}`,
    );
  });

  test("thread CRUD operations work", async ({ page }) => {
    await cleanupE2eConvAgents(page);

    const agentName = `e2e-conv-crud-${Date.now()}`;
    const agent = await createConvAgentViaAPI(page, agentName);

    // Run the agent to get a completed run
    const runResp = await page.request.post(
      `${BACKEND_URL}/api/workbench/agents/${agent.id}/runs`,
      { data: { input_prompt: "stats please", required_input_value: "" } },
    );
    const run = await runResp.json();
    expect(run.id).toBeTruthy();

    // Wait for run to complete
    await page.waitForTimeout(2000);

    // Create thread from run
    const threadResp = await page.request.post(
      `${BACKEND_URL}/api/workbench/threads/from-run/${run.id}`,
    );
    expect(threadResp.ok()).toBeTruthy();
    const thread = await threadResp.json();
    expect(thread.id).toBeTruthy();
    expect(thread.agent_id).toBe(agent.id);
    expect(thread.messages).toBeDefined();
    expect(thread.messages.length).toBeGreaterThanOrEqual(1);

    // Get thread
    const getResp = await page.request.get(
      `${BACKEND_URL}/api/workbench/threads/${thread.id}`,
    );
    expect(getResp.ok()).toBeTruthy();
    const fetched = await getResp.json();
    expect(fetched.id).toBe(thread.id);
    expect(fetched.messages.length).toBe(thread.messages.length);

    // List threads for agent
    const listResp = await page.request.get(
      `${BACKEND_URL}/api/workbench/threads?agent_id=${agent.id}`,
    );
    const listData = await listResp.json();
    expect(listData.threads.length).toBeGreaterThanOrEqual(1);

    // Delete thread
    const deleteResp = await page.request.delete(
      `${BACKEND_URL}/api/workbench/threads/${thread.id}`,
    );
    expect(deleteResp.ok()).toBeTruthy();

    // Verify deleted
    const afterDelete = await page.request.get(
      `${BACKEND_URL}/api/workbench/threads/${thread.id}`,
    );
    expect(afterDelete.status()).toBe(404);

    // Clean up
    await page.request.delete(
      `${BACKEND_URL}/api/workbench/agents/${agent.id}`,
    );
  });
});

// ---------------------------------------------------------------------------
// AG-UI Conversation (live — real LLM, requires running backend)
// ---------------------------------------------------------------------------

test.describe("Conversation Panel (live)", () => {
  test("run agent then continue chatting in modal", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await cleanupE2eConvAgents(page);

    const agentName = `e2e-conv-live-${Date.now()}`;
    const agent = await createConvAgentViaAPI(page, agentName);

    // Navigate to workbench
    await page.goto(`${APP_URL}/workbench`, { waitUntil: "load" });
    await expect(page.getByTestId("workbench-page-title")).toBeVisible();

    // Find agent card and click Run
    const card = page.getByTestId(`agent-card-${agent.id}`);
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.locator(`[data-testid="agent-card-run-${agent.id}"]`).click();

    // Wait for run to complete — modal auto-opens with completed result
    // The POST blocks until execution finishes, then modal opens
    // Wait for the chat input which appears only for completed runs
    await expect(page.getByTestId("conversation-input")).toBeVisible({ timeout: 90000 });

    // Verify run output is displayed
    const messages = page.getByTestId("run-conversation-messages");
    await expect(messages).toBeVisible();

    // Type a follow-up message
    const input = page.getByTestId("conversation-input");
    await input.fill("Can you break that down by priority?");
    await page.getByTestId("conversation-send").click();

    // Wait for follow-up response
    const assistantMsgs = page.getByTestId("chat-message-assistant");
    await expect(assistantMsgs.first()).toBeVisible({ timeout: 60000 });

    // Clean up
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('button').first().click();
    await page.request.delete(
      `${BACKEND_URL}/api/workbench/agents/${agent.id}`,
    );
  });

  test("continue in chat from AgentRunPage modal", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await cleanupE2eConvAgents(page);

    const agentName = `e2e-conv-menu-${Date.now()}`;

    // Create agent with show_in_menu=true
    const agent = await page.request
      .post(`${BACKEND_URL}/api/workbench/agents`, {
        data: {
          name: agentName,
          description: "E2E menu agent for modal test",
          system_prompt:
            "Use csv_ticket_stats and report the total. Keep it brief.",
          tool_names: ["csv_ticket_stats"],
          output_schema: {},
          requires_input: false,
          required_input_description: "",
          show_in_menu: true,
        },
      })
      .then((r) => r.json());

    // Navigate to app — agent tab should appear
    await page.goto(`${APP_URL}/csvtickets`, { waitUntil: "load" });
    const agentTab = page.getByTestId(`tab-agent-menu-${agent.id}`);
    await expect(agentTab).toBeVisible({ timeout: 10000 });
    await agentTab.click();

    await expect(page.getByTestId("agent-run-page-title")).toContainText(agentName);

    // Run the agent
    await page.getByTestId("agent-run-button").click();

    // Wait for output
    const output = page.getByTestId("agent-run-output");
    await expect(output).toBeVisible({ timeout: 60000 });

    // Click on run entry to open dialog
    const runEntries = page.locator('[data-testid^="agent-run-entry-"]');
    await expect(runEntries.first()).toBeVisible({ timeout: 10000 });
    await runEntries.first().click();

    // Dialog should open with "Continue in Chat" button
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    const continueBtn = page.getByTestId("continue-in-chat-button");
    await expect(continueBtn).toBeVisible();
    await continueBtn.click();

    // Conversation panel should appear
    const panel = page.getByTestId("conversation-panel");
    await expect(panel).toBeVisible({ timeout: 10000 });

    // Clean up
    await page.request.delete(
      `${BACKEND_URL}/api/workbench/agents/${agent.id}`,
    );
  });
});
