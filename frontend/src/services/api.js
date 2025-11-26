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
// Support Ticket APIs
// ============================================================================

export async function getSupportTickets(filters = {}) {
  const params = new URLSearchParams()
  if (filters.status) params.append('status', filters.status)
  if (filters.category) params.append('category', filters.category)
  if (filters.priority) params.append('priority', filters.priority)
  if (filters.limit) params.append('limit', filters.limit)
  
  const queryString = params.toString()
  return fetchJSON(`${API_BASE_URL}/support/tickets${queryString ? `?${queryString}` : ''}`)
}

export async function getSupportTicket(ticketId) {
  return fetchJSON(`${API_BASE_URL}/support/tickets/${ticketId}`)
}

export async function createSupportTicket(ticketData) {
  return fetchJSON(`${API_BASE_URL}/support/tickets`, {
    method: 'POST',
    body: JSON.stringify(ticketData),
  })
}

export async function updateSupportTicket(ticketId, updates) {
  return fetchJSON(`${API_BASE_URL}/support/tickets/${ticketId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
}

export async function deleteSupportTicket(ticketId) {
  return fetchJSON(`${API_BASE_URL}/support/tickets/${ticketId}`, {
    method: 'DELETE',
  })
}

// ============================================================================
// Support Dashboard Stats APIs
// ============================================================================

export async function getDashboardStats() {
  return fetchJSON(`${API_BASE_URL}/support/stats`)
}

export async function getTicketTrends(days = 30) {
  return fetchJSON(`${API_BASE_URL}/support/trends?days=${days}`)
}

export async function getCategoryPerformance() {
  return fetchJSON(`${API_BASE_URL}/support/category-performance`)
}

export async function getResolutionDistribution() {
  return fetchJSON(`${API_BASE_URL}/support/resolution-distribution`)
}

export async function getTechnicianPerformance() {
  return fetchJSON(`${API_BASE_URL}/support/technician-performance`)
}

export async function addWorklog(ticketId, worklogData) {
  return fetchJSON(`${API_BASE_URL}/support/tickets/${ticketId}/worklogs`, {
    method: 'POST',
    body: JSON.stringify(worklogData),
  })
}

export async function updateTicket(ticketId, updates) {
  return fetchJSON(`${API_BASE_URL}/support/tickets/${ticketId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
}

/**
 * Connect to Server-Sent Events stream for real-time dashboard updates
 * @param {Function} onMessage - Callback function for each stats update
 * @param {Function} onError - Callback function for errors
 * @returns {Function} Cleanup function to close the connection
 */
export function connectToStatsStream(onMessage, onError) {
  const eventSource = new EventSource(`${API_BASE_URL}/support/stats-stream`)

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
