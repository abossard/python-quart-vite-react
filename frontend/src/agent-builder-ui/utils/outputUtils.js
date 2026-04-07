/**
 * Output utilities — pure calculations (no side effects).
 *
 * Parse raw LLM output into objects suitable for SchemaRenderer.
 */

/**
 * Parse raw LLM output into an object suitable for SchemaRenderer.
 *
 * Handles:
 * - Already-parsed objects (returned as-is)
 * - JSON strings (parsed to object)
 * - JSON wrapped in markdown fences (```json ... ```) — fences stripped first
 * - Plain text / markdown (wrapped as { message: text })
 *
 * @param {*} output - Raw output from agent run (string or object)
 * @returns {object|null} Parsed object for SchemaRenderer, or null if empty
 */
export function parseRunOutput(output) {
  if (!output) return null
  if (typeof output !== 'string') return output

  let cleaned = output.trim()
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/)
  if (fenceMatch) cleaned = fenceMatch[1].trim()

  try {
    const parsed = JSON.parse(cleaned)
    if (typeof parsed === 'object' && parsed !== null) return parsed
  } catch { /* not JSON */ }

  return { message: output }
}
