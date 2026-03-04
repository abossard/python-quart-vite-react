/**
 * SchemaRenderer — Generic schema-driven output renderer.
 *
 * Takes structured agent output + its JSON Schema (with x-ui annotations)
 * and renders each property using the appropriate widget.
 *
 * Supported x-ui widgets:
 *   markdown    → ReactMarkdown (GFM)
 *   table       → HTML table with columns from x-ui.columns or auto-detected
 *   badge-list  → monospace badges
 *   stat-card   → big number + label
 *   bar-chart   → Nivo ResponsiveBar
 *   pie-chart   → Nivo ResponsivePie
 *   json        → formatted JSON <pre>
 *   hidden      → not rendered
 *
 * Auto-detection when no x-ui:
 *   string           → markdown
 *   number/integer   → stat-card
 *   array of objects → table
 *   array of strings → badge-list
 *   object           → json
 */

import { Text, makeStyles, tokens } from '@fluentui/react-components'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsivePie } from '@nivo/pie'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const useStyles = makeStyles({
  section: {
    marginBottom: tokens.spacingVerticalM,
  },
  label: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    marginBottom: tokens.spacingVerticalXS,
    display: 'block',
  },
  markdown: {
    '& h1, & h2, & h3': { margin: `${tokens.spacingVerticalXS} 0`, fontWeight: tokens.fontWeightSemibold },
    '& ul, & ol': { margin: `${tokens.spacingVerticalXS} 0`, paddingLeft: tokens.spacingHorizontalL },
    '& table': { width: '100%', borderCollapse: 'collapse', marginTop: tokens.spacingVerticalXS },
    '& th, & td': { border: `1px solid ${tokens.colorNeutralStroke1}`, padding: tokens.spacingHorizontalXS, textAlign: 'left' },
    '& pre': { backgroundColor: tokens.colorNeutralBackground3, padding: tokens.spacingHorizontalM, borderRadius: tokens.borderRadiusSmall, overflowX: 'auto' },
    '& code': { fontFamily: 'monospace', backgroundColor: tokens.colorNeutralBackground3, padding: '0 4px', borderRadius: tokens.borderRadiusSmall },
  },
  badgeList: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
  },
  badge: {
    background: tokens.colorNeutralBackground3,
    padding: '2px 8px',
    borderRadius: tokens.borderRadiusMedium,
    fontSize: tokens.fontSizeBase200,
    fontFamily: 'monospace',
  },
  statCard: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    background: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    minWidth: '100px',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: tokens.fontWeightBold,
    lineHeight: '1',
  },
  statLabel: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    marginTop: tokens.spacingVerticalXS,
  },
  chartContainer: {
    height: '250px',
    width: '100%',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: tokens.fontSizeBase200,
  },
  th: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    textAlign: 'left',
    backgroundColor: tokens.colorNeutralBackground3,
    borderBottom: `2px solid ${tokens.colorNeutralStroke1}`,
  },
  td: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  jsonPre: {
    backgroundColor: tokens.colorNeutralBackground3,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    fontSize: tokens.fontSizeBase200,
    overflow: 'auto',
    maxHeight: '200px',
    fontFamily: 'monospace',
  },
})

/**
 * Detect the best widget for a value when no x-ui annotation is present.
 */
function autoDetectWidget(value, propSchema) {
  const schemaType = propSchema?.type
  if (schemaType === 'string') return 'markdown'
  if (schemaType === 'integer' || schemaType === 'number') return 'stat-card'
  if (schemaType === 'array') {
    if (Array.isArray(value) && value.length > 0) {
      if (typeof value[0] === 'object' && value[0] !== null) return 'table'
      return 'badge-list'
    }
    const itemsType = propSchema?.items?.type
    if (itemsType === 'object') return 'table'
    return 'badge-list'
  }
  if (schemaType === 'object') return 'json'
  // Runtime fallback
  if (typeof value === 'string') return 'markdown'
  if (typeof value === 'number') return 'stat-card'
  if (Array.isArray(value)) return value.length > 0 && typeof value[0] === 'object' ? 'table' : 'badge-list'
  return 'json'
}

function MarkdownWidget({ value }) {
  const styles = useStyles()
  return (
    <div className={styles.markdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{String(value ?? '')}</ReactMarkdown>
    </div>
  )
}

function TableWidget({ value, ui }) {
  const styles = useStyles()
  if (!Array.isArray(value) || value.length === 0) {
    return <Text italic>No data</Text>
  }
  const columns = ui?.columns || Object.keys(value[0])
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col} className={styles.th}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {value.map((row, i) => (
          <tr key={i}>
            {columns.map((col) => (
              <td key={col} className={styles.td}>{typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col] ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function BadgeListWidget({ value }) {
  const styles = useStyles()
  if (!Array.isArray(value) || value.length === 0) return null
  return (
    <div className={styles.badgeList}>
      {value.map((item, i) => (
        <span key={i} className={styles.badge}>{String(item)}</span>
      ))}
    </div>
  )
}

function StatCardWidget({ value, ui }) {
  const styles = useStyles()
  const label = ui?.label || ''
  return (
    <div className={styles.statCard}>
      <span className={styles.statValue}>{value ?? 0}</span>
      {label && <span className={styles.statLabel}>{label}</span>}
    </div>
  )
}

function BarChartWidget({ value, ui }) {
  const styles = useStyles()
  if (!Array.isArray(value) || value.length === 0) return <Text italic>No chart data</Text>
  // Expect array of objects with at least one string key (category) and one numeric key
  const keys = Object.keys(value[0] || {})
  const indexKey = ui?.indexBy || keys.find((k) => typeof value[0][k] === 'string') || keys[0]
  const valueKeys = ui?.keys || keys.filter((k) => typeof value[0][k] === 'number')
  if (valueKeys.length === 0) {
    console.warn('[SchemaRenderer] bar-chart: no numeric keys found in data', value[0])
    return <Text italic>No numeric data for chart</Text>
  }
  return (
    <div className={styles.chartContainer}>
      <ResponsiveBar
        data={value}
        keys={valueKeys}
        indexBy={indexKey}
        margin={{ top: 10, right: 20, bottom: 40, left: 50 }}
        padding={0.3}
        colors={{ scheme: 'nivo' }}
        axisBottom={{ tickRotation: -30 }}
        axisLeft={{ tickSize: 5 }}
      />
    </div>
  )
}

function PieChartWidget({ value, ui }) {
  const styles = useStyles()
  // Accept: array of {id, value} or object {key: number}
  let pieData = []
  if (Array.isArray(value)) {
    pieData = value.map((item) => ({
      id: item[ui?.idKey || 'id'] || item.label || item.name || String(item),
      value: item[ui?.valueKey || 'value'] || item.count || 0,
    }))
  } else if (typeof value === 'object' && value !== null) {
    pieData = Object.entries(value).map(([k, v]) => ({ id: k, value: v }))
  }
  if (pieData.length === 0) return <Text italic>No chart data</Text>
  return (
    <div className={styles.chartContainer}>
      <ResponsivePie
        data={pieData}
        margin={{ top: 10, right: 80, bottom: 40, left: 80 }}
        innerRadius={0.4}
        padAngle={0.7}
        cornerRadius={3}
        colors={{ scheme: 'nivo' }}
        arcLinkLabelsSkipAngle={10}
        arcLabelsSkipAngle={10}
      />
    </div>
  )
}

function JsonWidget({ value }) {
  const styles = useStyles()
  return (
    <pre className={styles.jsonPre}>
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

const WIDGETS = {
  'markdown': MarkdownWidget,
  'table': TableWidget,
  'badge-list': BadgeListWidget,
  'stat-card': StatCardWidget,
  'bar-chart': BarChartWidget,
  'pie-chart': PieChartWidget,
  'json': JsonWidget,
}

/**
 * Render a single property value using the resolved widget.
 */
function PropertyRenderer({ name, value, propSchema, ui }) {
  const styles = useStyles()
  const widgetName = ui?.widget || autoDetectWidget(value, propSchema)

  if (widgetName === 'hidden') return null

  const Widget = WIDGETS[widgetName]
  if (!Widget) {
    console.warn(`[SchemaRenderer] Unknown widget "${widgetName}" for property "${name}", falling back to json`)
    return (
      <div className={styles.section}>
        <span className={styles.label}>{ui?.label || name}</span>
        <JsonWidget value={value} />
      </div>
    )
  }

  const label = ui?.label || propSchema?.description || name
  // Don't show label for markdown (it's self-describing)
  const showLabel = widgetName !== 'markdown'

  return (
    <div className={styles.section} data-testid={`schema-field-${name}`}>
      {showLabel && <span className={styles.label}>{label}</span>}
      <Widget value={value} ui={ui} />
    </div>
  )
}

/**
 * SchemaRenderer — main export.
 *
 * @param {object} props.data - The structured agent output (parsed JSON)
 * @param {object} props.schema - JSON Schema with optional x-ui annotations
 */
export default function SchemaRenderer({ data, schema }) {
  if (!data || typeof data !== 'object') {
    console.warn('[SchemaRenderer] No data to render', data)
    return null
  }

  const properties = schema?.properties || {}
  const propertyNames = Object.keys(properties)

  // If schema has no properties, auto-render all data keys
  const keysToRender = propertyNames.length > 0
    ? propertyNames.filter((key) => data[key] !== undefined)
    : Object.keys(data)

  if (keysToRender.length === 0) {
    console.warn('[SchemaRenderer] No matching properties between data and schema', { dataKeys: Object.keys(data), schemaKeys: propertyNames })
    return <JsonWidget value={data} />
  }

  console.debug('[SchemaRenderer] Rendering', keysToRender.length, 'properties', keysToRender)

  return (
    <div data-testid="schema-renderer">
      {keysToRender.map((key) => {
        const propSchema = properties[key] || {}
        const ui = propSchema['x-ui'] || null
        return (
          <PropertyRenderer
            key={key}
            name={key}
            value={data[key]}
            propSchema={propSchema}
            ui={ui}
          />
        )
      })}
    </div>
  )
}
