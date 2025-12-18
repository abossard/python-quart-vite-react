/**
 * Reminder Storage Module
 *
 * localStorage helpers for persisting reminder ticket selections
 * Following Grokking Simplicity: pure CALCULATIONS for data access
 *
 * Key: "reminder_selected_tickets"
 * Value: JSON array of ticket IDs
 */

const STORAGE_KEY = "reminder_selected_tickets";

// ============================================================================
// CALCULATIONS - Pure functions for localStorage access
// ============================================================================

/**
 * Get all selected ticket IDs from localStorage
 * @returns {string[]} Array of selected ticket IDs
 */
export function getSelectedTickets() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Toggle a ticket's selection state
 * @param {string} ticketId - The ticket ID to toggle
 */
export function toggleTicketSelection(ticketId) {
  const current = getSelectedTickets();
  const index = current.indexOf(ticketId);

  if (index === -1) {
    // Add to selection
    current.push(ticketId);
  } else {
    // Remove from selection
    current.splice(index, 1);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

/**
 * Clear all ticket selections
 */
export function clearSelections() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if a specific ticket is selected
 * @param {string} ticketId - The ticket ID to check
 * @returns {boolean} True if ticket is selected
 */
export function isTicketSelected(ticketId) {
  return getSelectedTickets().includes(ticketId);
}

/**
 * Set multiple tickets as selected (replaces current selection)
 * @param {string[]} ticketIds - Array of ticket IDs to select
 */
export function setSelectedTickets(ticketIds) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ticketIds));
}
