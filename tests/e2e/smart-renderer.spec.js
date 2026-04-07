import { expect, test } from "@playwright/test";
import { APP_URL } from "./helpers.js";

// The JSON payload the mocked agent "returns" embedded in markdown
const JSON_PAYLOAD = JSON.stringify({
  message: "Analysis complete for Balsiger Luis.",
  ticket_statistics: { total_tickets: 206, unique_topics: 6 },
  ticket_summary: [
    { incident_id: "INC000016349016", summary: "CHCrypt issue", status: "in_progress", priority: "medium" },
    { incident_id: "INC000016349133", summary: "CHCrypt LMS question", status: "in_progress", priority: "medium" },
    { incident_id: "INC000016348020", summary: "VPN deactivation needed", status: "pending", priority: "medium" },
  ],
  topic_distribution: [
    { topic: "CHCrypt", count: 4 },
    { topic: "VPN", count: 1 },
  ],
});

/**
 * Set up full workbench mocks including a completed run.
 * Follow-up messages return JSON-in-markdown via the AG-UI SSE endpoint.
 */
async function mockWorkbenchWithJsonResponse(page) {
  const agent = {
    id: "mock-sr-agent",
    name: "Mock SR Agent",
    description: "SmartRenderer test agent",
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

  const completedRun = {
    id: "mock-sr-completed-run",
    agent_id: "mock-sr-agent",
    status: "completed",
    output: "Initial run completed successfully.",
    error: null,
    created_at: new Date().toISOString(),
    input_prompt: "Analyze tickets for Balsiger Luis",
    tools_used: ["csv_ticket_stats"],
    agent_snapshot: { name: "Mock SR Agent" },
    activity_log: [],
  };

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
        body: JSON.stringify({ runs: [completedRun] }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route(`**/api/workbench/runs/${completedRun.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(completedRun),
    });
  });

  await page.route("**/api/workbench/events", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: { "Cache-Control": "no-cache" },
      body: "data: {}\n\n",
    });
  });

  await page.route("**/api/workbench/threads**", async (route) => {
    const url = route.request().url();
    if (url.includes("/from-run/")) {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-sr-thread",
          agent_id: "mock-sr-agent",
          title: "Chat from run",
          messages: [
            { id: "seed-user", role: "user", content: "Analyze tickets for Balsiger Luis" },
            { id: "seed-assistant", role: "assistant", content: "Initial run completed successfully." },
          ],
        }),
      });
      return;
    }
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ threads: [], messages: [] }),
      });
      return;
    }
    await route.fallback();
  });

  // AG-UI SSE: follow-up messages return JSON-in-markdown
  const threadId = "mock-sr-thread";
  await page.route("**/api/workbench/ag-ui", async (route) => {
    const runId = "mock-sr-run-followup";
    const msgId = "mock-sr-msg-followup";

    const assistantText =
      `Here is the analysis:\n\n\`\`\`json\n${JSON_PAYLOAD}\n\`\`\`\n\nLet me know if you need more details.`;

    const events = [
      { type: "RUN_STARTED", threadId, runId },
      {
        type: "STATE_SNAPSHOT",
        snapshot: { agent_id: "mock-sr-agent", agent_name: "Mock SR Agent", tools: ["csv_ticket_stats"] },
      },
      { type: "STEP_STARTED", stepName: "agent_execution" },
      { type: "TEXT_MESSAGE_START", messageId: msgId, role: "assistant" },
      { type: "TEXT_MESSAGE_CONTENT", messageId: msgId, delta: assistantText },
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

  return { agent, completedRun };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("SmartMessageRenderer — structured JSON rendering in chat", () => {
  test("renders JSON blocks as structured tables instead of raw code blocks", async ({ page }) => {
    await mockWorkbenchWithJsonResponse(page);

    await page.goto(`${APP_URL}/workbench`, { waitUntil: "load" });
    await expect(page.getByTestId("workbench-page-title")).toBeVisible();

    // Click completed run in the side panel to open RunConversationModal
    const runEntry = page.getByTestId("run-entry-mock-sr-completed-run");
    await expect(runEntry).toBeVisible({ timeout: 5000 });
    await runEntry.click();

    // Modal should open
    const messages = page.getByTestId("run-conversation-messages");
    await expect(messages).toBeVisible({ timeout: 5000 });

    // Send a follow-up message (triggers AG-UI SSE with JSON-in-markdown response)
    const input = page.getByTestId("conversation-input");
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill("Show me topic breakdown");
    await page.getByTestId("conversation-send").click();

    // Wait for assistant follow-up message to appear
    const assistantMsgs = page.getByTestId("chat-message-assistant");
    // There may be a seeded assistant message + the new follow-up one
    await expect(assistantMsgs.last()).toContainText("Here is the analysis", { timeout: 10000 });

    // --- KEY ASSERTIONS ---

    // 1. JSON should NOT be rendered as a raw <code class="language-json"> block
    const rawJsonCodeBlock = assistantMsgs.last().locator("code.language-json");
    await expect(rawJsonCodeBlock).toHaveCount(0);

    // 2. Structured content should be rendered as tables
    //    (ticket_summary and topic_distribution are arrays of objects → tables)
    const tables = assistantMsgs.last().locator("table");
    await expect(tables.first()).toBeVisible({ timeout: 5000 });

    // 3. Table contains expected data from the JSON payload
    await expect(assistantMsgs.last()).toContainText("INC000016349016");
    await expect(assistantMsgs.last()).toContainText("CHCrypt");
    await expect(assistantMsgs.last()).toContainText("VPN");

    // 4. Trailing markdown after JSON also renders
    await expect(assistantMsgs.last()).toContainText("Let me know if you need more details");
  });
});

test.describe("Continue in Chat — auto-continue after run completes", () => {
  test("shows Continue in Chat button on agent run page after run completes", async ({ page }) => {
    const agentId = "mock-sr-continue-agent";
    const agent = {
      id: agentId,
      name: "Mock Continue Agent",
      description: "Test auto-continue button",
      system_prompt: "test",
      tool_names: ["csv_ticket_stats"],
      output_schema: {},
      requires_input: false,
      required_input_description: "",
      show_in_menu: true,
      model: "",
      temperature: 0,
      recursion_limit: 3,
      max_tokens: 4096,
      reasoning_effort: "low",
      output_instructions: "",
      tool_names_json: '["csv_ticket_stats"]',
      success_criteria: [],
    };

    const completedRun = {
      id: "mock-continue-run",
      agent_id: agentId,
      status: "completed",
      output: "There are 206 tickets total.",
      error: null,
      created_at: new Date().toISOString(),
      input_prompt: "How many tickets?",
      tools_used: ["csv_ticket_stats"],
      agent_snapshot: { name: "Mock Continue Agent" },
      activity_log: [],
    };

    // Mock API endpoints
    await page.route("**/api/workbench/ui-config", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ endpoints: [], llm: {} }) });
    });
    await page.route("**/api/workbench/tools", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ tools: [{ name: "csv_ticket_stats", description: "Get ticket stats" }] }) });
    });
    await page.route("**/api/workbench/agents", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ agents: [agent] }) });
        return;
      }
      await route.fallback();
    });
    await page.route("**/api/workbench/events", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/event-stream", headers: { "Cache-Control": "no-cache" }, body: "data: {}\n\n" });
    });
    await page.route("**/api/workbench/threads**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ threads: [] }) });
        return;
      }
      await route.fallback();
    });

    // Mock runs endpoint — return a completed run for this agent
    await page.route("**/api/workbench/runs", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ runs: [completedRun] }) });
        return;
      }
      await route.fallback();
    });

    // Navigate to root — app loads agents with show_in_menu=true
    await page.goto(`${APP_URL}/`, { waitUntil: "load" });

    // Wait for the dynamic agent tab and click it
    const agentTab = page.getByTestId(`tab-agent-menu-${agentId}`);
    await expect(agentTab).toBeVisible({ timeout: 10000 });
    await agentTab.click();

    // Agent run page should render
    await expect(page.getByTestId("agent-run-page-title")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("agent-run-page-title")).toContainText("Mock Continue Agent");

    // The "Continue in Chat" button should be visible since there's a completed run
    const continueBtn = page.getByTestId("agent-run-continue-chat");
    await expect(continueBtn).toBeVisible({ timeout: 5000 });
    await expect(continueBtn).toContainText("Continue in Chat");
  });
});
