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
// IT Support Dashboard APIs
// ============================================================================

/**
 * Get comprehensive IT support statistics
 * @returns {Promise<Object>} Support statistics including ticket counts, resolution times, satisfaction scores
 */
export async function getSupportStats() {
  return fetchJSON(`${API_BASE_URL}/support/stats`)
}

/**
 * Get ticket trends over time
 * @param {string} period - Time period: '24h', '7d', or '30d'
 * @returns {Promise<Object>} Time-series data with created, resolved, and escalated tickets
 */
export async function getTicketTrends(period = '24h') {
  return fetchJSON(`${API_BASE_URL}/support/trends?period=${period}`)
}

/**
 * Get ticket category breakdown
 * @returns {Promise<Object>} Distribution of tickets across categories (hardware, software, network, etc.)
 */
export async function getCategoryBreakdown() {
  return fetchJSON(`${API_BASE_URL}/support/categories`)
}

/**
 * Get severity metrics
 * @returns {Promise<Object>} Ticket counts by severity level (critical, high, medium, low)
 */
export async function getSeverityMetrics() {
  return fetchJSON(`${API_BASE_URL}/support/severity`)
}

/**
 * Get technician performance data
 * @returns {Promise<Array>} Performance metrics for all technicians
 */
export async function getTechnicianPerformance() {
  return fetchJSON(`${API_BASE_URL}/support/technicians`)
}

/**
 * Get system health metrics
 * @returns {Promise<Object>} Real-time system health indicators
 */
export async function getSystemHealth() {
  return fetchJSON(`${API_BASE_URL}/support/health`)
}

/**
 * Connect to Server-Sent Events stream for live support metrics
 * @param {Function} onUpdate - Callback function for each metrics update
 * @param {Function} onError - Callback function for errors
 * @returns {Function} Cleanup function to close the connection
 */
export function connectToSupportStream(onUpdate, onError) {
  const eventSource = new EventSource(`${API_BASE_URL}/support/live-stream`)

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      onUpdate(data)
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
