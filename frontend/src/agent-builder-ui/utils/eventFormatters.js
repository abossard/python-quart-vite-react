/**
 * Event formatting utilities — pure calculations for SSE event display.
 *
 * Extracted from ActivityPage for reuse across components.
 */

/**
 * Format a timestamp (seconds or milliseconds) for display.
 * @param {number|string} ts - Unix timestamp
 * @returns {string} HH:MM:SS formatted time
 */
export function formatTime(ts) {
  const d = new Date(typeof ts === 'number' && ts > 1e12 ? ts : ts * 1000)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/**
 * Shorten an ID to its first 8 characters.
 * @param {string} id
 * @returns {string}
 */
export function shortId(id) {
  if (!id || typeof id !== 'string') return '???'
  return id.slice(0, 8)
}

/**
 * Generate a human-readable summary for an SSE event.
 * @param {object} evt - SSE event object
 * @returns {string} Summary text
 */
export function eventSummary(evt) {
  const t = evt.type || evt.event_type || ''
  switch (t) {
    case 'RUN_STARTED':
      return `Agent "${evt.agentName || '?'}" started — ${evt.inputPreview?.slice(0, 80) || ''}…`
    case 'RUN_FINISHED': {
      const parts = []
      if (evt.durationMs != null) parts.push(`${evt.durationMs}ms`)
      if (evt.toolsUsed?.length) parts.push(`tools: ${evt.toolsUsed.join(', ')}`)
      return `Done${parts.length ? ' — ' + parts.join(' · ') : ''}`
    }
    case 'RUN_ERROR':
      return `Failed: ${evt.message || 'unknown error'}`
    case 'STEP_STARTED':
      return evt.stepName === 'llm_call'
        ? `Thinking… (${evt.model || 'model'})`
        : `Step: ${evt.stepName}`
    case 'STEP_FINISHED': {
      if (evt.stepName === 'llm_call') {
        const parts = []
        if (evt.durationMs != null) parts.push(`${evt.durationMs}ms`)
        const tok = evt.tokenUsage || {}
        if (tok.total_tokens || tok.totalTokens) parts.push(`${tok.total_tokens || tok.totalTokens} tokens`)
        if (evt.finishReason) parts.push(evt.finishReason)
        if (evt.error) parts.push(`⚠️ ${evt.error}`)
        return parts.join(' · ') || 'LLM responded'
      }
      return `Step done: ${evt.stepName}`
    }
    case 'TOOL_CALL_START':
      return `→ ${evt.toolCallName || '?'}${evt.args ? '(' + evt.args.slice(0, 80) + ')' : ''}`
    case 'TOOL_CALL_END':
      return `← ${evt.toolCallName || '?'}${evt.durationMs != null ? ' (' + evt.durationMs + 'ms)' : ''}${evt.error ? ' ⚠️ ' + evt.error : ''}`
    case 'TOOL_CALL_RESULT':
      return `📄 ${evt.toolCallName || 'result'} → ${(evt.content || '').slice(0, 80)}`
    default:
      return t
  }
}

/**
 * Extract detail content for an event (args, output, error).
 * @param {object} evt - SSE event object
 * @returns {string|null} Detail text or null
 */
export function eventDetail(evt) {
  const t = evt.type || evt.event_type || ''
  switch (t) {
    case 'TOOL_CALL_START':
      return evt.args || null
    case 'TOOL_CALL_RESULT':
      return evt.content || null
    case 'RUN_FINISHED':
      return evt.outputPreview || null
    case 'RUN_ERROR':
      return evt.message || null
    case 'TOOL_CALL_END':
      return evt.error || null
    case 'STEP_FINISHED':
      return evt.error || null
    default:
      return null
  }
}
