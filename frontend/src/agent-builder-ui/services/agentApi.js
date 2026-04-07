/**
 * Agent Builder API — All workbench HTTP calls.
 *
 * Uses the shared fetchJSON from the app's api module.
 * Import this instead of reaching into services/api.js for workbench calls.
 */

let API_BASE = "/api";

/**
 * Configure the base URL for all agent builder API calls.
 * Call before any API function if your backend is on a different path.
 * @param {string} baseUrl - e.g. "/api" or "http://localhost:5001/api"
 */
export function configureApi(baseUrl) {
  API_BASE = baseUrl.replace(/\/+$/, "");
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: "Request failed" }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Config & Tools
// ============================================================================

export async function getUiConfig() {
  return fetchJSON(`${API_BASE}/workbench/ui-config`);
}

export async function listTools() {
  return fetchJSON(`${API_BASE}/workbench/tools`);
}

// ============================================================================
// Agent CRUD
// ============================================================================

export async function listAgents() {
  return fetchJSON(`${API_BASE}/workbench/agents`);
}

export async function createAgent(agentData) {
  return fetchJSON(`${API_BASE}/workbench/agents`, {
    method: "POST",
    body: JSON.stringify(agentData),
  });
}

export async function updateAgent(agentId, agentData) {
  return fetchJSON(`${API_BASE}/workbench/agents/${agentId}`, {
    method: "PUT",
    body: JSON.stringify(agentData),
  });
}

export async function deleteAgent(agentId) {
  return fetchJSON(`${API_BASE}/workbench/agents/${agentId}`, {
    method: "DELETE",
  });
}

// ============================================================================
// Runs
// ============================================================================

export async function startRun(
  agentId,
  { inputPrompt = "", requiredInputValue = "" } = {},
) {
  return fetchJSON(`${API_BASE}/workbench/agents/${agentId}/runs`, {
    method: "POST",
    body: JSON.stringify({
      input_prompt: inputPrompt,
      required_input_value: requiredInputValue || undefined,
    }),
  });
}

export async function listAgentRuns(agentId) {
  return fetchJSON(`${API_BASE}/workbench/agents/${agentId}/runs`);
}

export async function listAllRuns() {
  return fetchJSON(`${API_BASE}/workbench/runs`);
}

export async function getRun(runId) {
  return fetchJSON(`${API_BASE}/workbench/runs/${runId}`);
}

export async function deleteAllRuns() {
  return fetchJSON(`${API_BASE}/workbench/runs`, { method: "DELETE" });
}

// ============================================================================
// AI Assistance
// ============================================================================

export async function suggestSchema({
  name = "",
  description = "",
  systemPrompt = "",
} = {}) {
  return fetchJSON(`${API_BASE}/workbench/suggest-schema`, {
    method: "POST",
    body: JSON.stringify({
      name,
      description,
      system_prompt: systemPrompt,
    }),
  });
}

export async function improvePrompt({
  name = "",
  description = "",
  systemPrompt = "",
  toolNames = [],
} = {}) {
  return fetchJSON(`${API_BASE}/workbench/improve-prompt`, {
    method: "POST",
    body: JSON.stringify({
      name,
      description,
      system_prompt: systemPrompt,
      tool_names: toolNames,
    }),
  });
}

// ============================================================================
// Threads / Conversations
// ============================================================================

export async function listThreads(agentId) {
  const params = agentId ? `?agent_id=${agentId}` : "";
  return fetchJSON(`${API_BASE}/workbench/threads${params}`);
}

export async function getThread(threadId) {
  return fetchJSON(`${API_BASE}/workbench/threads/${threadId}`);
}

export async function deleteThread(threadId) {
  return fetchJSON(`${API_BASE}/workbench/threads/${threadId}`, {
    method: "DELETE",
  });
}

export async function getThreadMessages(threadId) {
  return fetchJSON(`${API_BASE}/workbench/threads/${threadId}/messages`);
}

export async function createThreadFromRun(runId) {
  return fetchJSON(`${API_BASE}/workbench/threads/from-run/${runId}`, {
    method: "POST",
  });
}
