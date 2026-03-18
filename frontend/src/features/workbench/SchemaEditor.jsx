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

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  propertyRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 100px 1fr 140px auto',
    gap: tokens.spacingHorizontalS,
    alignItems: 'end',
    padding: tokens.spacingVerticalXS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  widgetOptions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXS} 0 ${tokens.spacingVerticalXS} ${tokens.spacingHorizontalL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  addButton: {
    alignSelf: 'flex-start',
  },
  header: {
    display: 'grid',
    gridTemplateColumns: '1fr 100px 1fr 140px auto',
    gap: tokens.spacingHorizontalS,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
    padding: `0 ${tokens.spacingVerticalXS}`,
  },
})

function parseSchemaToProperties(schemaJson) {
  try {
    const schema = typeof schemaJson === 'string' ? JSON.parse(schemaJson) : schemaJson
    if (!schema?.properties) return []
    return Object.entries(schema.properties).map(([name, prop]) => ({
      name,
      type: prop.type || 'string',
      description: prop.description || '',
      widget: prop['x-ui']?.widget || '',
      widgetOptions: { ...prop['x-ui'] },
      itemsType: prop.items?.type || 'string',
    }))
  } catch {
    return []
  }
}

function propertiesToSchema(properties) {
  const schemaProps = {}
  for (const prop of properties) {
    if (!prop.name.trim()) continue
    const schemaProp = {
      type: prop.type,
      description: prop.description,
    }
    if (prop.type === 'array') {
      schemaProp.items = { type: prop.itemsType || 'string' }
    }
    if (prop.widget) {
      const opts = { ...prop.widgetOptions }
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

function PropertyRow({ property, onChange, onRemove }) {
  const styles = useStyles()

  const update = (field, value) => {
    onChange({ ...property, [field]: value })
  }

  const updateWidgetOption = (key, value) => {
    onChange({
      ...property,
      widgetOptions: { ...property.widgetOptions, [key]: value },
    })
  }

  const needsColumns = property.widget === 'table'
  const needsLabel = property.widget === 'stat-card'
  const needsChartConfig = property.widget === 'bar-chart'

  return (
    <>
      <div className={styles.propertyRow}>
        <Field size="small">
          <Input
            size="small"
            value={property.name}
            onChange={(_, d) => update('name', d.value)}
            placeholder="property_name"
            style={{ fontFamily: 'monospace' }}
          />
        </Field>
        <Field size="small">
          <Dropdown
            size="small"
            value={property.type}
            selectedOptions={[property.type]}
            onOptionSelect={(_, d) => update('type', d.optionValue)}
          >
            {TYPES.map((t) => <Option key={t} value={t}>{t}</Option>)}
          </Dropdown>
        </Field>
        <Field size="small">
          <Input
            size="small"
            value={property.description}
            onChange={(_, d) => update('description', d.value)}
            placeholder="description"
          />
        </Field>
        <Field size="small">
          <Dropdown
            size="small"
            value={WIDGETS.find((w) => w.value === property.widget)?.label || 'Auto-detect'}
            selectedOptions={[property.widget]}
            onOptionSelect={(_, d) => update('widget', d.optionValue)}
          >
            {WIDGETS.map((w) => <Option key={w.value} value={w.value}>{w.label}</Option>)}
          </Dropdown>
        </Field>
        <Button
          size="small"
          appearance="subtle"
          icon={<Delete24Regular />}
          onClick={onRemove}
          title="Remove property"
        />
      </div>
      {(needsColumns || needsLabel || needsChartConfig) && (
        <div className={styles.widgetOptions}>
          {needsColumns && (
            <Field label="Columns (comma-separated)" size="small">
              <Input
                size="small"
                value={(property.widgetOptions.columns || []).join(', ')}
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
                  value={(property.widgetOptions.keys || []).join(', ')}
                  onChange={(_, d) => updateWidgetOption('keys', d.value.split(',').map((s) => s.trim()).filter(Boolean))}
                  placeholder="e.g. count"
                />
              </Field>
            </>
          )}
        </div>
      )}
    </>
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
      {properties.length > 0 && (
        <div className={styles.header}>
          <span>Name</span>
          <span>Type</span>
          <span>Description</span>
          <span>Widget</span>
          <span />
        </div>
      )}
      {properties.map((prop, i) => (
        <PropertyRow
          key={i}
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
