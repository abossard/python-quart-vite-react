/**
 * API Service Module
 *
 * Following Grokking Simplicity principles:
 * - This module contains ACTIONS (functions with I/O)
 * - Separate from CALCULATIONS (pure functions in components)
 * - Clear interface for backend communication
 */

const API_BASE_URL = "/api";

// ============================================================================
// HTTP Helper Functions
// ============================================================================

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Health & Date APIs
// ============================================================================

export async function getHealth() {
  return fetchJSON(`${API_BASE_URL}/health`);
}

export async function getCurrentDate() {
  return fetchJSON(`${API_BASE_URL}/date`);
}

/**
 * Connect to Server-Sent Events stream for real-time time updates
 * @param {Function} onMessage - Callback function for each time update
 * @param {Function} onError - Callback function for errors
 * @returns {Function} Cleanup function to close the connection
 */
export function connectToTimeStream(onMessage, onError) {
  const eventSource = new EventSource(`${API_BASE_URL}/time-stream`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (error) {
      onError(error);
    }
  };

  eventSource.onerror = (error) => {
    onError(error);
    eventSource.close();
  };

  // Return cleanup function
  return () => {
    eventSource.close();
  };
}

// ============================================================================
// Task CRUD APIs
// ============================================================================

export async function getTasks(filter = "all") {
  const params = filter !== "all" ? `?filter=${filter}` : "";
  return fetchJSON(`${API_BASE_URL}/tasks${params}`);
}

export async function getTask(taskId) {
  return fetchJSON(`${API_BASE_URL}/tasks/${taskId}`);
}

export async function createTask(taskData) {
  return fetchJSON(`${API_BASE_URL}/tasks`, {
    method: "POST",
    body: JSON.stringify(taskData),
  });
}

export async function updateTask(taskId, updates) {
  return fetchJSON(`${API_BASE_URL}/tasks/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export async function deleteTask(taskId) {
  return fetchJSON(`${API_BASE_URL}/tasks/${taskId}`, {
    method: "DELETE",
  });
}

// ============================================================================
// Agent Chat APIs (Azure OpenAI + LangGraph)
// ============================================================================

/**
 * Run AI agent with the given prompt
 * Agent has access to task tools and ticket MCP tools
 * @param {string} prompt - User prompt for the agent
 * @returns {Promise<Object>} Response with result, agent_type, tools_used
 */
export async function agentChat(prompt) {
  try {
    return await fetchJSON(`${API_BASE_URL}/agents/run`, {
      method: "POST",
      body: JSON.stringify({ prompt, agent_type: "task_assistant" }),
    });
  } catch (error) {
    // Provide helpful message for support channel
    throw new Error("CHECK THE SUPPORT CHANNEL");
  }
}

// ============================================================================
// Tickets APIs
// ============================================================================

/**
 * Fetch tickets that need escalation
 * @returns {Promise<Object>} Response with tickets array
 */
export async function getQATickets() {
  return fetchJSON(`${API_BASE_URL}/qa-tickets`);
}

// ============================================================================
// CSV Tickets APIs
// ============================================================================

/**
 * Get available fields metadata for CSV tickets
 * @returns {Promise<Object>} Response with fields array and total count
 */
export async function getCSVTicketFields() {
  return fetchJSON(`${API_BASE_URL}/csv-tickets/fields`);
}

/**
 * Get CSV tickets with optional filtering, sorting, and field selection
 * @param {Object} options - Query options
 * @param {string[]} options.fields - Fields to include in response
 * @param {string} options.status - Filter by status
 * @param {boolean} options.hasAssignee - Filter by assignee presence
 * @param {string} options.assignedGroup - Filter by group name
 * @param {string} options.sort - Field to sort by
 * @param {string} options.sortDir - Sort direction (asc/desc)
 * @param {number} options.limit - Max results
 * @param {number} options.offset - Results to skip
 * @returns {Promise<Object>} Response with tickets array and metadata
 */
export async function getCSVTickets(options = {}) {
  const params = new URLSearchParams();

  if (options.fields?.length) {
    params.set("fields", options.fields.join(","));
  }
  if (options.status) {
    params.set("status", options.status);
  }
  if (options.hasAssignee !== undefined) {
    params.set("has_assignee", options.hasAssignee.toString());
  }
  if (options.assignedGroup) {
    params.set("assigned_group", options.assignedGroup);
  }
  if (options.sort) {
    params.set("sort", options.sort);
  }
  if (options.sortDir) {
    params.set("sort_dir", options.sortDir);
  }
  if (options.limit) {
    params.set("limit", options.limit.toString());
  }
  if (options.offset) {
    params.set("offset", options.offset.toString());
  }

  const queryString = params.toString();
  const url = queryString
    ? `${API_BASE_URL}/csv-tickets?${queryString}`
    : `${API_BASE_URL}/csv-tickets`;

  return fetchJSON(url);
}

/**
 * Get statistics for CSV tickets
 * @returns {Promise<Object>} Response with stats
 */
export async function getCSVTicketStats() {
  return fetchJSON(`${API_BASE_URL}/csv-tickets/stats`);
}
