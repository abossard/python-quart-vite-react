/**
 * SchemaEditor — Visual editor for JSON Schema with x-ui annotations.
 *
 * Renders a property list where users can:
 * - Add/remove properties
 * - Set name, type, description
 * - Pick x-ui widget from dropdown
 * - Configure widget-specific options (columns, label, etc.)
 *
 * Outputs valid JSON Schema string via onChange callback.
 */

import {
    Button,
    Dropdown,
    Field,
    Input,
    Option,
    Text,
    makeStyles,
    tokens,
} from '@fluentui/react-components'
import { Add24Regular, Delete24Regular } from '@fluentui/react-icons'
import { useCallback, useEffect, useState } from 'react'

const TYPES = ['string', 'integer', 'number', 'boolean', 'array', 'object']
const ARRAY_ITEM_TYPES = ['string', 'object']
const WIDGETS = [
  { value: '', label: 'Auto-detect' },
  { value: 'markdown', label: '📝 Markdown' },
  { value: 'table', label: '📊 Table' },
  { value: 'badge-list', label: '🏷️ Badge List' },
  { value: 'stat-card', label: '🔢 Stat Card' },
  { value: 'bar-chart', label: '📊 Bar Chart' },
  { value: 'pie-chart', label: '🥧 Pie Chart' },
  { value: 'json', label: '{ } JSON' },
  { value: 'hidden', label: '👁️‍🗨️ Hidden' },
]

const WIDGET_VALUES = new Set(WIDGETS.map((widget) => widget.value))

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  propertyCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  propertyHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.4fr) minmax(120px, 0.8fr) minmax(0, 1.5fr) minmax(160px, 1fr)',
    gap: tokens.spacingHorizontalM,
    alignItems: 'end',
    '@media (max-width: 900px)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
    '@media (max-width: 640px)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  wideField: {
    gridColumn: 'span 2',
    '@media (max-width: 900px)': {
      gridColumn: 'span 1',
    },
  },
  widgetOptions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingBottom: tokens.spacingVerticalS,
    '@media (max-width: 640px)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  addButton: {
    alignSelf: 'flex-start',
  },
  propertyTitle: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    minWidth: 0,
  },
  propertySubtitle: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
})

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
  return []
}

function normalizeType(value, fallback = 'string') {
  return typeof value === 'string' && TYPES.includes(value) ? value : fallback
}

function normalizeArrayItemType(value) {
  return typeof value === 'string' && ARRAY_ITEM_TYPES.includes(value) ? value : 'string'
}

function normalizeWidget(value) {
  return typeof value === 'string' && WIDGET_VALUES.has(value) ? value : ''
}

function normalizeWidgetOptions(rawOptions = {}) {
  const options = isRecord(rawOptions) ? rawOptions : {}
  return {
    ...options,
    columns: normalizeList(options.columns),
    keys: normalizeList(options.keys),
    label: typeof options.label === 'string' ? options.label : '',
    indexBy: typeof options.indexBy === 'string' ? options.indexBy : '',
    idKey: typeof options.idKey === 'string' ? options.idKey : '',
    valueKey: typeof options.valueKey === 'string' ? options.valueKey : '',
  }
}

function parseSchemaToProperties(schemaJson) {
  try {
    const schema = typeof schemaJson === 'string' ? JSON.parse(schemaJson) : schemaJson
    if (!isRecord(schema?.properties)) return []
    return Object.entries(schema.properties).map(([name, prop]) => {
      const property = isRecord(prop) ? prop : {}
      const widgetOptions = normalizeWidgetOptions(property['x-ui'])
      return {
      name,
      type: normalizeType(property.type),
      description: typeof property.description === 'string' ? property.description : '',
      widget: normalizeWidget(widgetOptions.widget),
      widgetOptions,
      itemsType: normalizeArrayItemType(property.items?.type),
    }})
  } catch {
    return []
  }
}

function cleanWidgetOptions(widgetOptions) {
  return Object.fromEntries(
    Object.entries(widgetOptions || {}).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'string') return value.trim().length > 0
      return value !== null && value !== undefined && value !== false
    }),
  )
}

function propertiesToSchema(properties) {
  const schemaProps = {}
  for (const prop of properties) {
    if (!prop.name.trim()) continue
    const schemaProp = {
      type: normalizeType(prop.type),
    }
    if (prop.description.trim()) {
      schemaProp.description = prop.description.trim()
    }
    if (prop.type === 'array') {
      schemaProp.items = { type: normalizeArrayItemType(prop.itemsType) }
    }
    if (prop.widget) {
      const opts = cleanWidgetOptions(prop.widgetOptions)
      delete opts.widget
      schemaProp['x-ui'] = { widget: prop.widget, ...opts }
    }
    schemaProps[prop.name] = schemaProp
  }
  return {
    type: 'object',
    properties: schemaProps,
  }
}

function PropertyRow({ index, property, onChange, onRemove }) {
  const styles = useStyles()

  const update = (field, value) => {
    onChange({ ...property, [field]: value })
  }

  const updateWidgetOption = (key, value) => {
    onChange({
      ...property,
      widgetOptions: normalizeWidgetOptions({ ...property.widgetOptions, [key]: value }),
    })
  }

  const needsColumns = property.widget === 'table'
  const needsLabel = property.widget === 'stat-card'
  const needsChartConfig = property.widget === 'bar-chart'

  return (
    <div className={styles.propertyCard}>
      <div className={styles.propertyHeader}>
        <div className={styles.propertyTitle}>
          <Text weight="semibold">{property.name.trim() || `Property ${index + 1}`}</Text>
          <span className={styles.propertySubtitle}>Configure how this output field is stored and rendered.</span>
        </div>
        <Button
          size="small"
          appearance="subtle"
          icon={<Delete24Regular />}
          onClick={onRemove}
          title="Remove property"
        >
          Remove
        </Button>
      </div>

      <div className={styles.fieldGrid}>
        <Field label="Name" size="small">
          <Input
            size="small"
            value={property.name}
            onChange={(_, d) => update('name', d.value)}
            placeholder="property_name"
            style={{ fontFamily: 'monospace' }}
          />
        </Field>
        <Field label="Type" size="small">
          <Dropdown
            size="small"
            value={property.type}
            selectedOptions={[property.type]}
            onOptionSelect={(_, d) => update('type', d.optionValue)}
          >
            {TYPES.map((t) => <Option key={t} value={t}>{t}</Option>)}
          </Dropdown>
        </Field>
        <Field label="Description" size="small" className={styles.wideField}>
          <Input
            size="small"
            value={property.description}
            onChange={(_, d) => update('description', d.value)}
            placeholder="description"
          />
        </Field>
        <Field label="Widget" size="small">
          <Dropdown
            size="small"
            value={WIDGETS.find((w) => w.value === property.widget)?.label || 'Auto-detect'}
            selectedOptions={[property.widget]}
            onOptionSelect={(_, d) => update('widget', d.optionValue)}
          >
            {WIDGETS.map((w) => <Option key={w.value} value={w.value}>{w.label}</Option>)}
          </Dropdown>
        </Field>
        {property.type === 'array' && (
          <Field label="Array item type" size="small">
            <Dropdown
              size="small"
              value={property.itemsType}
              selectedOptions={[property.itemsType]}
              onOptionSelect={(_, d) => update('itemsType', d.optionValue)}
            >
              {ARRAY_ITEM_TYPES.map((type) => <Option key={type} value={type}>{type}</Option>)}
            </Dropdown>
          </Field>
        )}
      </div>

      {(needsColumns || needsLabel || needsChartConfig) && (
        <div className={styles.widgetOptions}>
          {needsColumns && (
            <Field label="Columns (comma-separated)" size="small">
              <Input
                size="small"
                value={normalizeList(property.widgetOptions.columns).join(', ')}
                onChange={(_, d) => updateWidgetOption('columns', d.value.split(',').map((s) => s.trim()).filter(Boolean))}
                placeholder="col1, col2, col3"
              />
            </Field>
          )}
          {needsLabel && (
            <Field label="Display label" size="small">
              <Input
                size="small"
                value={property.widgetOptions.label || ''}
                onChange={(_, d) => updateWidgetOption('label', d.value)}
                placeholder="e.g. Total Issues"
              />
            </Field>
          )}
          {needsChartConfig && (
            <>
              <Field label="Index by (category key)" size="small">
                <Input
                  size="small"
                  value={property.widgetOptions.indexBy || ''}
                  onChange={(_, d) => updateWidgetOption('indexBy', d.value)}
                  placeholder="e.g. status"
                />
              </Field>
              <Field label="Value keys (comma-separated)" size="small">
                <Input
                  size="small"
                  value={normalizeList(property.widgetOptions.keys).join(', ')}
                  onChange={(_, d) => updateWidgetOption('keys', d.value.split(',').map((s) => s.trim()).filter(Boolean))}
                  placeholder="e.g. count"
                />
              </Field>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * SchemaEditor — main export.
 *
 * @param {string} props.value - Current JSON Schema as string
 * @param {function} props.onChange - Called with new JSON Schema string
 */
export default function SchemaEditor({ value, onChange }) {
  const styles = useStyles()
  const [properties, setProperties] = useState(() => parseSchemaToProperties(value))

  // Sync from external value changes (e.g. suggest-schema fills it)
  useEffect(() => {
    const parsed = parseSchemaToProperties(value)
    if (parsed.length > 0 || !value?.trim()) {
      setProperties(parsed)
    }
  }, [value])

  const emitChange = useCallback((newProperties) => {
    setProperties(newProperties)
    const schema = propertiesToSchema(newProperties)
    console.debug('[SchemaEditor] Schema updated', schema)
    onChange(JSON.stringify(schema, null, 2))
  }, [onChange])

  const addProperty = () => {
    emitChange([...properties, {
      name: '',
      type: 'string',
      description: '',
      widget: '',
      widgetOptions: {},
      itemsType: 'string',
    }])
  }

  const updateProperty = (index, updated) => {
    const next = [...properties]
    next[index] = updated
    emitChange(next)
  }

  const removeProperty = (index) => {
    emitChange(properties.filter((_, i) => i !== index))
  }

  return (
    <div className={styles.container} data-testid="schema-editor">
      {properties.map((prop, i) => (
        <PropertyRow
          key={i}
          index={i}
          property={prop}
          onChange={(updated) => updateProperty(i, updated)}
          onRemove={() => removeProperty(i)}
        />
      ))}
      <Button
        className={styles.addButton}
        size="small"
        appearance="subtle"
        icon={<Add24Regular />}
        onClick={addProperty}
        data-testid="schema-editor-add-property"
      >
        Add property
      </Button>
    </div>
  )
}
