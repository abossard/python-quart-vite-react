/**
 * API Service Module
 *
 * Following Grokking Simplicity principles:
 * - This module contains ACTIONS (functions with I/O)
 * - Separate from CALCULATIONS (pure functions in components)
 * - Clear interface for backend communication
 */

const API_BASE_URL = '/api'

// ============================================================================
// HTTP Helper Functions
// ============================================================================

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

// ============================================================================
// Health & Date APIs
// ============================================================================

export async function getHealth() {
  return fetchJSON(`${API_BASE_URL}/health`)
}

export async function getCurrentDate() {
  return fetchJSON(`${API_BASE_URL}/date`)
}

/**
 * Connect to Server-Sent Events stream for real-time time updates
 * @param {Function} onMessage - Callback function for each time update
 * @param {Function} onError - Callback function for errors
 * @returns {Function} Cleanup function to close the connection
 */
export function connectToTimeStream(onMessage, onError) {
  const eventSource = new EventSource(`${API_BASE_URL}/time-stream`)

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      onMessage(data)
    } catch (error) {
      onError(error)
    }
  }

  eventSource.onerror = (error) => {
    onError(error)
    eventSource.close()
  }

  // Return cleanup function
  return () => {
    eventSource.close()
  }
}

// ============================================================================
// Task CRUD APIs
// ============================================================================

export async function getTasks(filter = 'all') {
  const params = filter !== 'all' ? `?filter=${filter}` : ''
  return fetchJSON(`${API_BASE_URL}/tasks${params}`)
}

export async function getTask(taskId) {
  return fetchJSON(`${API_BASE_URL}/tasks/${taskId}`)
}

export async function createTask(taskData) {
  return fetchJSON(`${API_BASE_URL}/tasks`, {
    method: 'POST',
    body: JSON.stringify(taskData),
  })
}

export async function updateTask(taskId, updates) {
  return fetchJSON(`${API_BASE_URL}/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
}

export async function deleteTask(taskId) {
  return fetchJSON(`${API_BASE_URL}/tasks/${taskId}`, {
    method: 'DELETE',
  })
}

// ============================================================================
// Ollama LLM APIs
// ============================================================================

/**
 * Send a chat message to Ollama and get a response
 * @param {Object} chatRequest - Chat request with messages array, model, and temperature
 * @returns {Promise<Object>} Response with message, model, and metadata
 */
export async function ollamaChat(chatRequest) {
  return fetchJSON(`${API_BASE_URL}/ollama/chat`, {
    method: 'POST',
    body: JSON.stringify(chatRequest),
  })
}

/**
 * List all available Ollama models
 * @returns {Promise<Object>} Response with models array
 */
export async function listOllamaModels() {
  return fetchJSON(`${API_BASE_URL}/ollama/models`)
}

// ============================================================================
// Ticket APIs
// ============================================================================

/**
 * Search for a ticket by ticket ID
 * @param {string} ticketId - The ticket ID to search for (UUID format)
 * @returns {Promise<Object|null>} Ticket object if found, {ticket: null} if not found
 */
export async function searchTickets(ticketId) {
  const params = ticketId ? `?ticket_id=${encodeURIComponent(ticketId)}` : ''
  return fetchJSON(`${API_BASE_URL}/tickets/search${params}`)
}

/**
 * Generate a Knowledge Base Article from a ticket
 * @param {Object} ticket - The ticket object to generate KBA from
 * @returns {Promise<Object>} Generated KBA with title, question, answer
 */
export async function generateKBA(ticket) {
  return fetchJSON(`${API_BASE_URL}/kba/generate`, {
    method: 'POST',
    body: JSON.stringify(ticket),
  })
}
