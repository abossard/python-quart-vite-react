const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi

export function formatDateTime(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

export function upsertRun(runs, updatedRun, maxSize = 25) {
  const index = runs.findIndex((item) => item.id === updatedRun.id)
  if (index === -1) {
    return [updatedRun, ...runs].slice(0, maxSize)
  }

  const next = [...runs]
  next[index] = updatedRun
  next.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  return next
}

export function parseTicketIds(rawValue) {
  if (rawValue == null) return []

  const asText = Array.isArray(rawValue)
    ? rawValue.join(',')
    : String(rawValue)

  const uuidMatches = asText.match(UUID_PATTERN)
  if (uuidMatches?.length) {
    return uuidMatches.map((value) => value.toLowerCase())
  }

  return asText
    .split(/[\n,;\s]+/)
    .map((value) => value.trim())
    .filter(Boolean)
}

export function extractTicketIdsFromRows(rows, ticketIdFields = ['ticket_ids', 'ticket_id', 'ticketIds']) {
  const ids = new Set()
  for (const row of rows || []) {
    if (!row || typeof row !== 'object') continue
    for (const field of ticketIdFields) {
      const fieldValue = row[field]
      for (const parsedId of parseTicketIds(fieldValue)) {
        ids.add(parsedId)
      }
    }
  }
  return Array.from(ids)
}

export function sanitizeMarkdownForDisplay(markdown) {
  if (!markdown) return ''
  return markdown.replace(/```json[\s\S]*?```/gi, '').trim()
}
