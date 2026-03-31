/**
 * AG-UI Tool Render Components
 *
 * Calculations: pure render functions for each SchemaRenderer widget type.
 * Each function takes tool call args and returns a React element.
 * Registered via useRenderToolCall inside CopilotKit context.
 *
 * Following Grokking Simplicity: these are pure calculations (data → UI).
 */

import { ResponsiveBar } from '@nivo/bar'
import { ResponsivePie } from '@nivo/pie'
import { makeStyles, tokens, Text, Badge } from '@fluentui/react-components'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const useStyles = makeStyles({
  widgetContainer: {
    margin: '8px 0',
    maxWidth: '100%',
    overflow: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    '& th, & td': {
      padding: '6px 10px',
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      textAlign: 'left',
    },
    '& th': {
      backgroundColor: tokens.colorNeutralBackground3,
      fontWeight: 600,
    },
    '& tr:nth-child(even)': {
      backgroundColor: tokens.colorNeutralBackground2,
    },
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px 24px',
    borderRadius: '8px',
    backgroundColor: tokens.colorNeutralBackground2,
    minWidth: '120px',
  },
  statValue: {
    fontSize: '36px',
    fontWeight: 700,
    lineHeight: 1.2,
    color: tokens.colorBrandForeground1,
  },
  statLabel: {
    fontSize: '13px',
    color: tokens.colorNeutralForeground3,
    marginTop: '4px',
  },
  badgeList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  badge: {
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  chartContainer: {
    height: '300px',
    width: '100%',
  },
  json: {
    backgroundColor: tokens.colorNeutralBackground2,
    padding: '12px',
    borderRadius: '6px',
    fontFamily: 'monospace',
    fontSize: '12px',
    overflow: 'auto',
    maxHeight: '400px',
    whiteSpace: 'pre-wrap',
  },
  markdown: {
    '& table': {
      borderCollapse: 'collapse',
      width: '100%',
    },
    '& th, & td': {
      padding: '4px 8px',
      border: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    '& code': {
      backgroundColor: tokens.colorNeutralBackground2,
      padding: '1px 4px',
      borderRadius: '3px',
      fontFamily: 'monospace',
      fontSize: '13px',
    },
  },
})

// ---------------------------------------------------------------------------
// Pure render components (Calculations — data in, JSX out)
// ---------------------------------------------------------------------------

export function MarkdownWidget({ content }) {
  const styles = useStyles()
  return (
    <div className={styles.markdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content || ''}
      </ReactMarkdown>
    </div>
  )
}

export function TableWidget({ data, columns }) {
  const styles = useStyles()
  if (!Array.isArray(data) || data.length === 0) {
    return <Text italic>No data</Text>
  }
  const cols = columns || Object.keys(data[0] || {})
  return (
    <div className={styles.widgetContainer}>
      <table className={styles.table}>
        <thead>
          <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {cols.map(c => <td key={c}>{String(row[c] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function StatCardWidget({ value, label }) {
  const styles = useStyles()
  return (
    <div className={styles.statCard}>
      <span className={styles.statValue}>{value ?? '—'}</span>
      {label && <span className={styles.statLabel}>{label}</span>}
    </div>
  )
}

export function BadgeListWidget({ items }) {
  const styles = useStyles()
  if (!Array.isArray(items) || items.length === 0) {
    return <Text italic>No items</Text>
  }
  return (
    <div className={styles.badgeList}>
      {items.map((item, i) => (
        <Badge key={i} appearance="outline" className={styles.badge}>
          {String(item)}
        </Badge>
      ))}
    </div>
  )
}

export function BarChartWidget({ data, indexBy, keys }) {
  const styles = useStyles()
  if (!Array.isArray(data) || data.length === 0) {
    return <Text italic>No chart data</Text>
  }
  const idx = indexBy || Object.keys(data[0])[0]
  const k = keys || Object.keys(data[0]).filter(key => key !== idx)
  return (
    <div className={styles.chartContainer}>
      <ResponsiveBar
        data={data}
        indexBy={idx}
        keys={k}
        margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
        padding={0.3}
        colors={{ scheme: 'paired' }}
        axisBottom={{ tickRotation: -30 }}
      />
    </div>
  )
}

export function PieChartWidget({ data }) {
  const styles = useStyles()
  if (!Array.isArray(data) || data.length === 0) {
    return <Text italic>No chart data</Text>
  }
  return (
    <div className={styles.chartContainer}>
      <ResponsivePie
        data={data}
        margin={{ top: 20, right: 80, bottom: 20, left: 80 }}
        innerRadius={0.4}
        padAngle={0.7}
        cornerRadius={3}
        colors={{ scheme: 'paired' }}
        arcLinkLabelsTextColor={tokens.colorNeutralForeground1}
      />
    </div>
  )
}

export function JsonWidget({ data }) {
  const styles = useStyles()
  const formatted = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  return <pre className={styles.json}>{formatted}</pre>
}

// ---------------------------------------------------------------------------
// Widget resolver (Calculation: schema + data → component)
// ---------------------------------------------------------------------------

const WIDGET_MAP = {
  markdown: MarkdownWidget,
  table: TableWidget,
  'stat-card': StatCardWidget,
  'badge-list': BadgeListWidget,
  'bar-chart': BarChartWidget,
  'pie-chart': PieChartWidget,
  json: JsonWidget,
}

/**
 * Resolve the right widget for a given value and optional schema property.
 * Pure calculation — no side effects.
 */
export function resolveWidget(value, schemaProp) {
  const widgetName = schemaProp?.['x-ui']?.widget
  if (widgetName && WIDGET_MAP[widgetName]) {
    return widgetName
  }
  // Auto-detect from value shape
  if (typeof value === 'string') return 'markdown'
  if (typeof value === 'number') return 'stat-card'
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === 'object') return 'table'
    return 'badge-list'
  }
  return 'json'
}

/**
 * Render structured output using schema x-ui annotations.
 * Used when agent returns structured JSON matching output_schema.
 */
export function StructuredOutputRenderer({ output, schema }) {
  const styles = useStyles()

  if (!output || typeof output !== 'object') {
    return <MarkdownWidget content={String(output || '')} />
  }

  const properties = schema?.properties || {}
  const entries = Object.entries(output)

  return (
    <div className={styles.widgetContainer}>
      {entries.map(([key, value]) => {
        const prop = properties[key]
        if (prop?.['x-ui']?.widget === 'hidden') return null
        const widgetName = resolveWidget(value, prop)
        const Widget = WIDGET_MAP[widgetName] || JsonWidget
        const widgetProps = buildWidgetProps(widgetName, value, prop)
        return (
          <div key={key} style={{ marginBottom: '12px' }}>
            <Text weight="semibold" size={300} style={{ display: 'block', marginBottom: '4px' }}>
              {prop?.description || key}
            </Text>
            <Widget {...widgetProps} />
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Smart message renderer — detects JSON blocks and renders them structurally
// ---------------------------------------------------------------------------

const JSON_FENCE_RE = /```json\s*\n?([\s\S]*?)\n?```/gi

/**
 * Split a markdown string into alternating segments of prose and parsed JSON.
 * Pure calculation — no side effects.
 *
 * @param {string} content - Raw assistant message (markdown with optional JSON fences)
 * @returns {{ type: 'markdown'|'json', value: string|object }[]}
 */
function splitMarkdownAndJson(content) {
  if (!content || typeof content !== 'string') return []

  // Try parsing the entire content as JSON first (no fences)
  const trimmed = content.trim()
  try {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed === 'object' && parsed !== null) {
      return [{ type: 'json', value: parsed }]
    }
  } catch { /* not pure JSON */ }

  const segments = []
  let lastIndex = 0
  let match

  // Reset regex state
  JSON_FENCE_RE.lastIndex = 0

  while ((match = JSON_FENCE_RE.exec(content)) !== null) {
    // Add markdown before this JSON block
    const before = content.slice(lastIndex, match.index).trim()
    if (before) segments.push({ type: 'markdown', value: before })

    // Parse JSON block
    try {
      const parsed = JSON.parse(match[1].trim())
      if (typeof parsed === 'object' && parsed !== null) {
        segments.push({ type: 'json', value: parsed })
      } else {
        // Primitive JSON value — render as markdown
        segments.push({ type: 'markdown', value: match[0] })
      }
    } catch {
      // Invalid JSON — keep as markdown code block
      segments.push({ type: 'markdown', value: match[0] })
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining markdown after last JSON block
  const remaining = content.slice(lastIndex).trim()
  if (remaining) segments.push({ type: 'markdown', value: remaining })

  return segments
}

/**
 * Smart message renderer for assistant chat messages.
 * Detects JSON blocks in markdown and renders them with structured widgets
 * (tables, stat cards, badge lists) instead of raw <pre><code> blocks.
 * Falls back to plain MarkdownWidget when no JSON is detected.
 */
export function SmartMessageRenderer({ content, schema }) {
  const styles = useStyles()
  const segments = splitMarkdownAndJson(content)

  // No JSON found — fast path: plain markdown
  if (segments.length === 0) {
    return <MarkdownWidget content={content} />
  }
  if (segments.length === 1 && segments[0].type === 'markdown') {
    return <MarkdownWidget content={segments[0].value} />
  }

  return (
    <div className={styles.widgetContainer}>
      {segments.map((seg, i) => {
        if (seg.type === 'markdown') {
          return <MarkdownWidget key={i} content={seg.value} />
        }
        return (
          <StructuredOutputRenderer key={i} output={seg.value} schema={schema} />
        )
      })}
    </div>
  )
}

/**
 * Build props for a specific widget from value and schema property.
 * Pure calculation.
 */
function buildWidgetProps(widgetName, value, schemaProp) {
  const uiConfig = schemaProp?.['x-ui'] || {}
  switch (widgetName) {
    case 'markdown':
      return { content: String(value || '') }
    case 'table':
      return { data: value, columns: uiConfig.columns }
    case 'stat-card':
      return { value, label: uiConfig.label || schemaProp?.description }
    case 'badge-list':
      return { items: value }
    case 'bar-chart':
      return { data: value, indexBy: uiConfig.indexBy, keys: uiConfig.keys }
    case 'pie-chart':
      return { data: value }
    case 'json':
    default:
      return { data: value }
  }
}
