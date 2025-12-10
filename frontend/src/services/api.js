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

/**
 * Connect to real-time data events stream
 * Receives updates when any data changes (devices, users, etc.)
 * 
 * @param {Function} onEvent - Callback for data change events
 * @param {Function} onError - Callback for errors
 * @returns {Function} Cleanup function to close the connection
 * 
 * Event types:
 * - device:created, device:updated, device:deleted
 * - device:borrowed, device:returned, device:missing
 * - user:created, user:updated, user:deleted
 * - department:created, department:updated, department:deleted
 * - amt:created, amt:updated, amt:deleted
 */
export function connectToEventsStream(onEvent, onError) {
  const eventSource = new EventSource(`${API_BASE_URL}/events-stream`)

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      // Ignore connection confirmation
      if (data.type !== 'connected') {
        onEvent(data)
      }
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

export async function getTaskStats() {
  return fetchJSON(`${API_BASE_URL}/tasks/stats`)
}

export async function getPriorityStats() {
  return fetchJSON(`${API_BASE_URL}/tasks/priority-stats`)
}

export async function getUrgentTasks() {
  return fetchJSON(`${API_BASE_URL}/tasks/urgent`)
}

// ============================================================================
// User Management APIs
// ============================================================================

export async function getUsers() {
  return fetchJSON('http://localhost:5001/api/users', {
    credentials: 'include',
  })
}

export async function getUser(userId) {
  return fetchJSON(`http://localhost:5001/api/users/${userId}`, {
    credentials: 'include',
  })
}

export async function createUser(userData) {
  return fetchJSON('http://localhost:5001/api/users', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify(userData),
  })
}

export async function updateUser(userId, updates) {
  return fetchJSON(`http://localhost:5001/api/users/${userId}`, {
    method: 'PUT',
    credentials: 'include',
    body: JSON.stringify(updates),
  })
}

export async function deleteUser(userId) {
  return fetchJSON(`http://localhost:5001/api/users/${userId}`, {
    method: 'DELETE',
    credentials: 'include',
  })
}

export async function changeUserLocation(userId, locationId) {
  return fetchJSON(`http://localhost:5001/api/users/${userId}/change-location`, {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({ location_id: locationId }),
  })
}

// ============================================================================
// Auth APIs
// ============================================================================

export async function getCurrentUser() {
  const response = await fetch('http://localhost:5001/api/auth/session', {
    credentials: 'include',
  })
  
  if (!response.ok) {
    return null
  }
  
  const data = await response.json()
  return data.authenticated ? data.user : null
}

// ============================================================================
// Admindir User Search APIs
// ============================================================================

/**
 * Search for users in admindir.verzeichnisse.admin.ch via backend proxy
 * @param {string} searchTerm - Search term (e.g., name)
 * @param {string} lang - Language code (default: 'de')
 * @returns {Promise<Array>} Array of user suggestions
 */
export async function searchAdmindirUsers(searchTerm, lang = 'de') {
  if (!searchTerm || searchTerm.trim().length < 2) {
    return []
  }

  try {
    const url = `http://localhost:5001/api/admindir/search?s=${encodeURIComponent(searchTerm)}&lang=${lang}`
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Admindir search failed: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Admindir search error:', error)
    throw new Error('Fehler beim Suchen in Admindir')
  }
}
