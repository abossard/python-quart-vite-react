import {
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Dropdown,
    Field,
    Input,
    Option,
    Spinner,
    Text,
    Textarea,
    makeStyles,
    tokens,
} from '@fluentui/react-components'
import { useEffect, useState } from 'react'
import { updateWorkbenchAgent } from '../../services/api'
import { buildModelOptions } from './modelOptions'
import SchemaEditor from './SchemaEditor'

const useStyles = makeStyles({
  dialogSurface: {
    width: 'min(92vw, 860px)',
    maxWidth: '860px',
    maxHeight: '88vh',
  },
  dialogContent: {
    overflowY: 'auto',
    maxHeight: 'calc(88vh - 120px)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  toolsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    maxHeight: '200px',
    overflowY: 'auto',
    padding: `${tokens.spacingVerticalXS} 0`,
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
  },
})

export default function AgentEditDialog({ agent, tools, modelOptions = [], serviceDefaultModel = '', onSave, onClose }) {
  const styles = useStyles()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    requiresInput: false,
    requiredInputDescription: '',
    model: '',
    showInMenu: false,
  })
  const [selectedToolNames, setSelectedToolNames] = useState([])
  const [outputSchema, setOutputSchema] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!agent) return
    setFormData({
      name: agent.name || '',
      description: agent.description || '',
      systemPrompt: agent.system_prompt || '',
      requiresInput: Boolean(agent.requires_input),
      requiredInputDescription: agent.required_input_description || '',
      model: agent.model || '',
      showInMenu: Boolean(agent.show_in_menu),
    })
    setSelectedToolNames(agent.tool_names || [])
    setOutputSchema(
      agent.output_schema && Object.keys(agent.output_schema).length > 0
        ? JSON.stringify(agent.output_schema, null, 2)
        : '',
    )
    setError('')
    setSaving(false)
  }, [agent])

  const toggleTool = (toolName) => {
    setSelectedToolNames((prev) =>
      prev.includes(toolName)
        ? prev.filter((n) => n !== toolName)
        : [...prev, toolName],
    )
  }

  const resolvedModelOptions = buildModelOptions(modelOptions, formData.model)
  const selectedModelOption = formData.model || '__service_default__'
  const modelDisplayValue = formData.model || (serviceDefaultModel ? `Service default (${serviceDefaultModel})` : 'Service default')

  const handleSave = async () => {
    setError('')
    let parsedSchema = {}
    if (outputSchema.trim()) {
      try {
        parsedSchema = JSON.parse(outputSchema)
      } catch {
        setError('Output schema is not valid JSON')
        return
      }
    }

    setSaving(true)
    try {
      const result = await updateWorkbenchAgent(agent.id, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        system_prompt: formData.systemPrompt.trim(),
        requires_input: formData.requiresInput,
        required_input_description: formData.requiresInput
          ? formData.requiredInputDescription.trim()
          : '',
        model: formData.model.trim(),
        tool_names: selectedToolNames,
        output_schema: parsedSchema,
        show_in_menu: formData.showInMenu,
      })
      onClose()
      void Promise.resolve(onSave?.(result))
    } catch (err) {
      setError(err?.message || 'Failed to update agent')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={Boolean(agent)} onOpenChange={(_, data) => { if (!data.open) onClose() }}>
      <DialogSurface className={styles.dialogSurface} data-testid="agent-edit-dialog">
        <DialogBody>
          <DialogTitle>{`Edit Agent: ${agent?.name || ''}`}</DialogTitle>
          <DialogContent className={styles.dialogContent}>
            <div className={styles.form}>
              <Field label="Name" required>
                <Input
                  data-testid="edit-agent-name"
                  value={formData.name}
                  onChange={(_, d) => setFormData((prev) => ({ ...prev, name: d.value }))}
                />
              </Field>

              <Field label="Description">
                <Input
                  data-testid="edit-agent-description"
                  value={formData.description}
                  onChange={(_, d) => setFormData((prev) => ({ ...prev, description: d.value }))}
                />
              </Field>

              <Field label="System prompt" required>
                <Textarea
                  data-testid="edit-agent-system-prompt"
                  resize="vertical"
                  rows={6}
                  value={formData.systemPrompt}
                  onChange={(_, d) => setFormData((prev) => ({ ...prev, systemPrompt: d.value }))}
                />
              </Field>

              <Field label="Model">
                <Dropdown
                  data-testid="edit-agent-model"
                  value={modelDisplayValue}
                  selectedOptions={[selectedModelOption]}
                  onOptionSelect={(_, data) => {
                    const nextModel = data.optionValue === '__service_default__' ? '' : (data.optionValue || '')
                    setFormData((prev) => ({ ...prev, model: nextModel }))
                  }}
                >
                  <Option value="__service_default__">
                    {serviceDefaultModel ? `Service default (${serviceDefaultModel})` : 'Service default'}
                  </Option>
                  {resolvedModelOptions.map((modelName) => (
                    <Option key={modelName} value={modelName}>
                      {modelName}
                    </Option>
                  ))}
                </Dropdown>
              </Field>

              <Checkbox
                data-testid="edit-agent-requires-input"
                label="Require input?"
                checked={formData.requiresInput}
                onChange={(_, d) => {
                  const checked = Boolean(d.checked)
                  setFormData((prev) => ({
                    ...prev,
                    requiresInput: checked,
                    requiredInputDescription: checked ? prev.requiredInputDescription : '',
                  }))
                }}
              />

              {formData.requiresInput && (
                <Field label="Input description" required>
                  <Input
                    data-testid="edit-agent-required-input-desc"
                    value={formData.requiredInputDescription}
                    onChange={(_, d) => setFormData((prev) => ({ ...prev, requiredInputDescription: d.value }))}
                  />
                </Field>
              )}

              <Checkbox
                data-testid="edit-agent-show-in-menu"
                label="Show in menu"
                checked={formData.showInMenu}
                onChange={(_, d) => setFormData((prev) => ({ ...prev, showInMenu: Boolean(d.checked) }))}
              />

              <Field label="Tools">
                <div className={styles.toolsList}>
                  {tools.map((tool) => (
                    <Checkbox
                      key={tool.name}
                      data-testid={`edit-agent-tool-${tool.name}`}
                      label={`${tool.name}${tool.description ? ` — ${tool.description}` : ''}`}
                      checked={selectedToolNames.includes(tool.name)}
                      onChange={() => toggleTool(tool.name)}
                    />
                  ))}
                </div>
              </Field>

              <Field label="Output schema">
                <SchemaEditor value={outputSchema} onChange={setOutputSchema} />
              </Field>

              {error && (
                <Text className={styles.error} data-testid="edit-agent-error">
                  {error}
                </Text>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button
              data-testid="edit-agent-cancel"
              appearance="secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              data-testid="edit-agent-save"
              appearance="primary"
              onClick={handleSave}
              disabled={saving}
              icon={saving ? <Spinner size="tiny" /> : undefined}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
