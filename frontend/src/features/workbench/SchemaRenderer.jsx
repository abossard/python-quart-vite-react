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

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
  return []
}

function normalizeUiConfig(ui) {
  return isRecord(ui) ? ui : null
}

function isPrimitiveValue(value) {
  return value == null || ['string', 'number', 'boolean'].includes(typeof value)
}

function canRenderWidget(widgetName, value) {
  switch (widgetName) {
    case 'markdown':
    case 'stat-card':
      return isPrimitiveValue(value)
    case 'table':
    case 'badge-list':
      return Array.isArray(value)
    case 'bar-chart':
    case 'pie-chart':
      return Array.isArray(value) || isRecord(value)
    case 'json':
    case 'hidden':
    case 'recursive':
      return true
    default:
      return false
  }
}

function resolveWidgetName(value, propSchema, ui) {
  const configuredWidget = typeof ui?.widget === 'string' ? ui.widget : null
  if (configuredWidget && canRenderWidget(configuredWidget, value)) {
    return configuredWidget
  }

  const autoWidget = autoDetectWidget(value, propSchema)
  if (canRenderWidget(autoWidget, value)) {
    if (configuredWidget) {
      console.warn(
        `[SchemaRenderer] Widget "${configuredWidget}" is incompatible with value shape, falling back to "${autoWidget}"`,
        value,
      )
    }
    return autoWidget
  }

  if (configuredWidget) {
    console.warn(
      `[SchemaRenderer] Widget "${configuredWidget}" is incompatible with value shape, falling back to json`,
      value,
    )
  }
  return 'json'
}

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
    height: '300px',
    maxWidth: '600px',
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
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
  },
})

/**
 * Detect the best widget for a value when no x-ui annotation is present.
 */
function autoDetectWidget(value, propSchema) {
  if (isRecord(value)) return 'recursive'
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === 'object') {
      // Arrays of {id, value} or {name, value} → pie-chart
      if (looksLikePieData(value)) return 'pie-chart'
      return 'table'
    }
    return 'badge-list'
  }
  if (typeof value === 'string') return 'markdown'
  if (typeof value === 'number' || typeof value === 'boolean') return 'stat-card'

  const schemaType = propSchema?.type
  if (schemaType === 'string') return 'markdown'
  if (schemaType === 'integer' || schemaType === 'number') return 'stat-card'
  if (schemaType === 'array') {
    const itemsType = propSchema?.items?.type
    if (itemsType === 'object') return 'table'
    return 'badge-list'
  }
  if (schemaType === 'object') return 'recursive'
  return 'json'
}

/**
 * Heuristic: does this array look like pie chart data?
 * Matches [{id: string, value: number}, ...] or [{name: string, value: number}, ...]
 */
function looksLikePieData(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false
  return arr.every(item => {
    if (!isRecord(item)) return false
    const keys = Object.keys(item)
    if (keys.length < 2 || keys.length > 3) return false
    const hasValue = typeof item.value === 'number' || typeof item.count === 'number'
    const hasLabel = typeof item.id === 'string' || typeof item.name === 'string' || typeof item.label === 'string'
    return hasValue && hasLabel
  })
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
  const resolvedUi = normalizeUiConfig(ui)
  const firstRow = value.find((row) => row !== undefined && row !== null)
  const columns = normalizeStringList(resolvedUi?.columns)
  const fallbackColumns = isRecord(firstRow) ? Object.keys(firstRow) : ['value']
  const columnsToRender = columns.length > 0 ? columns : fallbackColumns

  const renderCellValue = (row, column) => {
    const cellValue = isRecord(row) || Array.isArray(row) ? row[column] : column === 'value' ? row : ''
    if (typeof cellValue === 'object' && cellValue !== null) {
      return JSON.stringify(cellValue)
    }
    return String(cellValue ?? '')
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {columnsToRender.map((col) => (
            <th key={col} className={styles.th}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {value.map((row, i) => (
          <tr key={i}>
            {columnsToRender.map((col) => (
              <td key={col} className={styles.td}>{renderCellValue(row, col)}</td>
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
      <span className={styles.statValue}>{String(value ?? 0)}</span>
      {label && <span className={styles.statLabel}>{label}</span>}
    </div>
  )
}

function BarChartWidget({ value, ui }) {
  const styles = useStyles()
  const resolvedUi = normalizeUiConfig(ui)
  // Accept array of objects OR an object {key: number} (auto-convert)
  let chartData = value
  if (!Array.isArray(value) && typeof value === 'object' && value !== null) {
    chartData = Object.entries(value)
      .filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => ({ category: k, value: v }))
  }
  if (!Array.isArray(chartData) || chartData.length === 0) return <Text italic>No chart data</Text>

  const keys = Object.keys(chartData[0] || {})
  const configuredKeys = normalizeStringList(resolvedUi?.keys)
  const indexKey = typeof resolvedUi?.indexBy === 'string' && resolvedUi.indexBy.trim()
    ? resolvedUi.indexBy.trim()
    : keys.find((k) => typeof chartData[0][k] === 'string') || keys[0]
  const valueKeys = configuredKeys.length > 0
    ? configuredKeys
    : keys.filter((k) => typeof chartData[0][k] === 'number')
  if (valueKeys.length === 0) return <Text italic>No numeric data for chart</Text>

  return (
    <div className={styles.chartContainer}>
      <ResponsiveBar
        data={chartData}
        keys={valueKeys}
        indexBy={indexKey}
        margin={{ top: 10, right: 20, bottom: 60, left: 50 }}
        padding={0.3}
        colors={{ scheme: 'nivo' }}
        axisBottom={{ tickRotation: -45, truncateTickAt: 15 }}
        axisLeft={{ tickSize: 5 }}
        labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
      />
    </div>
  )
}

function PieChartWidget({ value, ui }) {
  const styles = useStyles()
  const resolvedUi = normalizeUiConfig(ui)
  const valueKey = typeof resolvedUi?.valueKey === 'string' && resolvedUi.valueKey.trim()
    ? resolvedUi.valueKey.trim()
    : 'value'
  const idKey = typeof resolvedUi?.idKey === 'string' && resolvedUi.idKey.trim()
    ? resolvedUi.idKey.trim()
    : 'id'
  // Accept: array of {id, value} or object {key: number}
  let pieData = []
  if (Array.isArray(value)) {
    pieData = value
      .filter((item) => isRecord(item) && typeof (item[valueKey] ?? item.count) === 'number')
      .map((item) => ({
        id: String(item[idKey] || item.label || item.name || item),
        value: item[valueKey] || item.count || 0,
      }))
  } else if (typeof value === 'object' && value !== null) {
    pieData = Object.entries(value)
      .filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => ({ id: String(k), value: v }))
  }
  if (pieData.length === 0) return <Text italic>No chart data</Text>
  return (
    <div className={styles.chartContainer}>
      <ResponsivePie
        data={pieData}
        margin={{ top: 20, right: 100, bottom: 40, left: 100 }}
        innerRadius={0.4}
        padAngle={0.7}
        cornerRadius={3}
        colors={{ scheme: 'nivo' }}
        arcLinkLabelsSkipAngle={10}
        arcLabelsSkipAngle={10}
        arcLinkLabel={(d) => `${d.id} (${d.value})`}
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
  const widgetName = resolveWidgetName(value, propSchema, ui)

  if (widgetName === 'hidden') return null

  // Recursive rendering for nested objects
  if (widgetName === 'recursive' && isRecord(value)) {
    const subSchema = propSchema?.properties ? propSchema : undefined
    const label = ui?.label || propSchema?.description || name
    return (
      <div className={styles.section} data-testid={`schema-field-${name}`}>
        <span className={styles.label}>{label}</span>
        <SchemaRenderer data={value} schema={subSchema} />
      </div>
    )
  }

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

  const properties = isRecord(schema?.properties) ? schema.properties : {}
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
        const propSchema = isRecord(properties[key]) ? properties[key] : {}
        const ui = normalizeUiConfig(propSchema['x-ui'])
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
