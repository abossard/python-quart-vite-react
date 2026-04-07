/**
 * Shared E2E test helpers.
 *
 * Eliminates copy-paste across spec files for URL constants,
 * navigation, agent CRUD, and dialog handling.
 */

import { expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// URL constants
// ---------------------------------------------------------------------------

export const APP_URL = process.env.E2E_APP_URL || "http://localhost:3001";
export const BACKEND_URL = APP_URL.replace("3001", "5001");

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * Navigate to a page and wait for the app shell to render.
 * @param {import('@playwright/test').Page} page
 * @param {string} path - URL path (e.g. "/workbench", "/activity")
 */
export async function visit(page, path = "/") {
  const url = path === "/" ? APP_URL : `${APP_URL}${path}`;
  await page.goto(url, { waitUntil: "load" });
  await expect(page.getByText("CSV Ticket Viewer")).toBeVisible();
}

// ---------------------------------------------------------------------------
// Agent CRUD via API
// ---------------------------------------------------------------------------

/**
 * Create an agent via the backend API.
 * @param {import('@playwright/test').Page} page
 * @param {object} overrides - fields to override in the agent definition
 * @returns {Promise<object>} created agent JSON
 */
export async function createAgentViaAPI(page, overrides = {}) {
  const resp = await page.request.post(`${BACKEND_URL}/api/workbench/agents`, {
    data: {
      name: overrides.name || `e2e-agent-${Date.now()}`,
      description: overrides.description || "E2E test agent",
      system_prompt:
        overrides.systemPrompt ||
        overrides.system_prompt ||
        "Use csv_ticket_stats and report the total. Keep it short.",
      tool_names: overrides.tool_names || ["csv_ticket_stats"],
      output_schema: overrides.output_schema || {},
      requires_input: overrides.requires_input || false,
      required_input_description: overrides.required_input_description || "",
      show_in_menu: overrides.show_in_menu || false,
    },
  });
  return resp.json();
}

/**
 * Delete all agents whose name includes the given prefix.
 * Also deletes threads belonging to those agents.
 * @param {import('@playwright/test').Page} page
 * @param {string} prefix - name prefix to match (default: "e2e-")
 */
export async function cleanupAgents(page, prefix = "e2e-") {
  const resp = await page.request.get(`${BACKEND_URL}/api/workbench/agents`);
  for (const a of (await resp.json()).agents || []) {
    if (a.name.includes(prefix)) {
      // Delete threads first (FK constraint)
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

// ---------------------------------------------------------------------------
// Run helpers
// ---------------------------------------------------------------------------

/**
 * Start an agent run via API and return the run object.
 * @param {import('@playwright/test').Page} page
 * @param {string} agentId
 * @param {string} prompt
 * @returns {Promise<object>} run JSON
 */
export async function runAgentViaAPI(page, agentId, prompt = "") {
  const resp = await page.request.post(
    `${BACKEND_URL}/api/workbench/agents/${agentId}/runs`,
    { data: { input_prompt: prompt } },
  );
  const run = await resp.json();
  if (!run || !run.id) {
    throw new Error(
      `runAgentViaAPI failed: status=${resp.status()} body=${JSON.stringify(run)}`,
    );
  }
  return run;
}

/**
 * Poll until a run reaches a terminal status (completed/failed/truncated).
 * @param {import('@playwright/test').Page} page
 * @param {string} runId
 * @param {number} timeoutMs - max wait time (default: 15s)
 * @returns {Promise<object>} final run JSON
 */
export async function waitForRunCompletion(page, runId, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const resp = await page.request.get(
      `${BACKEND_URL}/api/workbench/runs/${runId}`,
    );
    const run = await resp.json();
    if (["completed", "failed", "truncated"].includes(run.status)) {
      return run;
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`Run ${runId} did not complete within ${timeoutMs}ms`);
}

// ---------------------------------------------------------------------------
// Dialog helpers
// ---------------------------------------------------------------------------

/**
 * Close any open dialog/modal if visible.
 * @param {import('@playwright/test').Page} page
 */
export async function closeDialogIfOpen(page) {
  const dialog = page.locator("[role=dialog]").last();
  if (await dialog.isVisible({ timeout: 1000 }).catch(() => false)) {
    await dialog.locator("button").first().click();
    await expect(dialog).toBeHidden({ timeout: 5000 });
  }
}
