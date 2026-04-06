import {
    Button,
    Card,
    Checkbox,
    Combobox,
    Dropdown,
    Field,
    Input,
    Option,
    Text,
    Textarea,
    makeStyles,
    tokens,
} from '@fluentui/react-components'
import { useEffect, useState } from 'react'
import {
    createWorkbenchAgent,
    improvePrompt,
    suggestOutputSchema,
    updateWorkbenchAgent,
} from '../../services/api'
import { buildModelOptions } from './modelOptions'
import SchemaEditor from './SchemaEditor'

const useStyles = makeStyles({
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  toolsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    padding: `${tokens.spacingVerticalXS} 0`,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingHorizontalL,
    alignItems: 'start',
  },
})

// ---------------------------------------------------------------------------
// Pre-built agent templates
// ---------------------------------------------------------------------------

const AGENT_TEMPLATES = [
  {
    id: 'topic-product-analysis',
    name: 'Topic & Product Analysis',
    description: 'Analyze which topics, products, and services generate the most tickets and find patterns',
    system_prompt: `You are a data analyst specializing in IT support operations. Your job is to analyze ticket data to understand which topics, products, and services generate the most issues.

Steps:
1. Use csv_ticket_stats to get an overview of the ticket landscape (totals, status distribution, priority breakdown).
2. Use csv_search_tickets_with_details to retrieve tickets and examine their categorization, summaries, and resolution patterns.
3. Analyze the data across these dimensions:
   - **Top topics**: What are the most common issue themes based on summaries and notes?
   - **Product/Service breakdown**: Which products or services appear most often?
   - **Priority vs. product**: Which products have the most critical/high-priority tickets?
   - **Resolution patterns**: Which topics get resolved fastest vs. stay open longest?
   - **Group workload**: Which assigned groups handle which products/topics?
4. Identify actionable patterns and recommend focus areas for improvement.

Present findings with counts and percentages where possible.`,
    tool_names: ['csv_ticket_stats', 'csv_search_tickets_with_details', 'csv_list_tickets', 'csv_count_tickets'],
    requires_input: false,
    required_input_description: '',
    show_in_menu: false,
  },
  {
    id: 'next-step-advisor',
    name: 'Next Step Advisor',
    description: 'Figure out the next action to solve or continue work on a ticket or topic',
    system_prompt: `You are a senior support advisor. Given a ticket or topic, you determine the best next steps to resolve or make progress on the issue.

Steps:
1. If the user provides an INC number, use csv_get_ticket to get full details.
2. If the user provides a topic, use csv_search_tickets_with_details to find relevant tickets.
3. Analyze the current state: status, priority, existing notes, resolution attempts, assigned group.
4. Look for similar resolved tickets using csv_search_tickets to find proven solutions.
5. Produce actionable recommendations:
   - **Current Situation**: Brief summary of where things stand
   - **Immediate Next Step**: The single most impactful action to take now
   - **Alternative Approaches**: 2-3 other options if the first doesn't work
   - **Escalation Path**: When and to whom to escalate if needed
   - **Similar Resolved Tickets**: Reference tickets that had similar issues and how they were solved

Be specific and actionable — avoid vague advice.`,
    tool_names: ['csv_get_ticket', 'csv_search_tickets_with_details', 'csv_search_tickets', 'csv_ticket_stats'],
    requires_input: true,
    required_input_description: 'Ticket INC number (e.g. INC000016349327) or topic description',
    show_in_menu: false,
  },
]

const EMPTY_FORM = {
  name: '',
  description: '',
  systemPrompt: '',
  model: '',
  requiresInput: false,
  requiredInputDescription: '',
  showInMenu: false,
}

const EMPTY_ERRORS = {
  name: '',
  systemPrompt: '',
  tools: '',
  requiredInputDescription: '',
}

function formDataFromAgent(agent) {
  return {
    name: agent.name || '',
    description: agent.description || '',
    systemPrompt: agent.system_prompt || '',
    model: agent.model || '',
    requiresInput: Boolean(agent.requires_input),
    requiredInputDescription: agent.required_input_description || '',
    showInMenu: Boolean(agent.show_in_menu),
  }
}

export default function AgentCreateForm({ tools, onAgentCreated, initialData, modelOptions = [], serviceDefaultModel = '' }) {
  const styles = useStyles()
  const isEditing = Boolean(initialData?.id)

  const [formData, setFormData] = useState(
    initialData ? formDataFromAgent(initialData) : EMPTY_FORM,
  )
  const [fieldErrors, setFieldErrors] = useState({ ...EMPTY_ERRORS })
  const [selectedToolNames, setSelectedToolNames] = useState(() => {
    if (initialData?.tool_names) {
      return [...initialData.tool_names]
    }
    return []  // No tools selected by default — use "Suggest Schema & Tools"
  })
  const [outputSchema, setOutputSchema] = useState(() => {
    if (initialData?.output_schema && Object.keys(initialData.output_schema).length > 0) {
      return JSON.stringify(initialData.output_schema, null, 2)
    }
    return ''
  })
  const [suggestingSchema, setSuggestingSchema] = useState(false)
  const [improvingPrompt, setImprovingPrompt] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const applyTemplate = (templateId) => {
    const tpl = AGENT_TEMPLATES.find((t) => t.id === templateId)
    if (!tpl) return
    setFormData({
      name: tpl.name,
      description: tpl.description,
      systemPrompt: tpl.system_prompt,
      model: '',
      requiresInput: Boolean(tpl.requires_input),
      requiredInputDescription: tpl.required_input_description || '',
      showInMenu: Boolean(tpl.show_in_menu),
    })
    setSelectedToolNames([...tpl.tool_names])
    setOutputSchema('')
    setFieldErrors({ ...EMPTY_ERRORS })
    setError('')
  }

  // Keep tool selection in sync when tools list changes (remove stale names)
  useEffect(() => {
    if (isEditing) return
    const availableNames = tools.map((t) => t.name)
    setSelectedToolNames((prev) =>
      prev.filter((name) => availableNames.includes(name)),
    )
  }, [tools, isEditing])

  const toggleTool = (toolName) => {
    setSelectedToolNames((prev) => (
      prev.includes(toolName)
        ? prev.filter((item) => item !== toolName)
        : [...prev, toolName]
    ))
    setFieldErrors((prev) => ({ ...prev, tools: '' }))
  }

  const validateForm = () => {
    const nextErrors = {
      name: '',
      systemPrompt: '',
      tools: '',
      requiredInputDescription: '',
    }
    if (!formData.name.trim()) {
      nextErrors.name = 'Agent name is required'
    }
    if (!formData.systemPrompt.trim()) {
      nextErrors.systemPrompt = 'System prompt is required'
    }
    if (formData.requiresInput && !formData.requiredInputDescription.trim()) {
      nextErrors.requiredInputDescription = 'Input description is required when input is required'
    }
    if (selectedToolNames.length === 0) {
      nextErrors.tools = 'Select at least one tool'
    }
    setFieldErrors(nextErrors)
    return !nextErrors.name && !nextErrors.systemPrompt && !nextErrors.tools && !nextErrors.requiredInputDescription
  }

  const handleSuggestSchemaAndTools = async () => {
    setSuggestingSchema(true)
    setError('')
    try {
      const resp = await suggestOutputSchema({
        name: formData.name.trim(),
        description: formData.description.trim(),
        systemPrompt: formData.systemPrompt.trim(),
      })
      if (resp.schema) {
        setOutputSchema(JSON.stringify(resp.schema, null, 2))
      }
      if (resp.tool_names && Array.isArray(resp.tool_names)) {
        setSelectedToolNames(resp.tool_names)
      }
    } catch (err) {
      setError(err?.message || 'Failed to suggest schema and tools')
    } finally {
      setSuggestingSchema(false)
    }
  }

  const handleImprovePrompt = async () => {
    setImprovingPrompt(true)
    setError('')
    try {
      const resp = await improvePrompt({
        name: formData.name.trim(),
        description: formData.description.trim(),
        systemPrompt: formData.systemPrompt.trim(),
        toolNames: selectedToolNames,
      })
      if (resp.improved_prompt) {
        setFormData((prev) => ({ ...prev, systemPrompt: resp.improved_prompt }))
      }
    } catch (err) {
      setError(err?.message || 'Failed to improve prompt')
    } finally {
      setImprovingPrompt(false)
    }
  }

  const handleSubmit = async () => {
    setError('')
    if (!validateForm()) return

    let parsedSchema = {}
    if (outputSchema.trim()) {
      try {
        parsedSchema = JSON.parse(outputSchema)
      } catch {
        setError('Output schema is not valid JSON')
        return
      }
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      system_prompt: formData.systemPrompt.trim(),
      model: formData.model.trim(),
      requires_input: formData.requiresInput,
      required_input_description: formData.requiresInput
        ? formData.requiredInputDescription.trim()
        : '',
      tool_names: selectedToolNames,
      output_schema: parsedSchema,
      success_criteria: [],
      show_in_menu: formData.showInMenu,
    }

    setSubmitting(true)
    try {
      let result
      if (isEditing) {
        result = await updateWorkbenchAgent(initialData.id, payload)
      } else {
        result = await createWorkbenchAgent(payload)
      }

      if (!isEditing) {
        setFormData({ ...EMPTY_FORM })
        setOutputSchema('')
        setSelectedToolNames(tools.map((t) => t.name))
        setFieldErrors({ ...EMPTY_ERRORS })
      }

      if (onAgentCreated) {
        onAgentCreated(result)
      }
    } catch (err) {
      setError(err?.message || `Failed to ${isEditing ? 'update' : 'create'} agent`)
    } finally {
      setSubmitting(false)
    }
  }

  const submitLabel = isEditing
    ? (submitting ? 'Saving...' : 'Save Agent')
    : (submitting ? 'Creating...' : 'Create Agent')
  const resolvedModelOptions = buildModelOptions(modelOptions, formData.model)
  const selectedModelOption = formData.model || '__service_default__'
  const modelDisplayValue = formData.model || (serviceDefaultModel ? `Service default (${serviceDefaultModel})` : 'Service default')

  return (
    <div className={styles.grid}>
      <Card>
        <div className={styles.cardBody}>
          {error && <Text>{error}</Text>}
          {!isEditing && (
            <Field label="Start from a template" hint="Pre-fills the form with a ready-to-use agent configuration">
              <Combobox
                data-testid="workbench-template-select"
                placeholder="Choose a template..."
                onOptionSelect={(_, data) => {
                  if (data.optionValue) applyTemplate(data.optionValue)
                }}
              >
                {AGENT_TEMPLATES.map((tpl) => (
                  <Option key={tpl.id} value={tpl.id} text={tpl.name}>
                    <div>
                      <Text weight="semibold">{tpl.name}</Text>
                      <br />
                      <Text size={200} style={{ color: tokens.colorNeutralForeground4 }}>
                        {tpl.description}
                      </Text>
                    </div>
                  </Option>
                ))}
              </Combobox>
            </Field>
          )}
          <Field label="Agent name" required>
            <Input
              data-testid="workbench-agent-name-input"
              value={formData.name}
              onChange={(_, data) => {
                setFormData((prev) => ({ ...prev, name: data.value }))
                setFieldErrors((prev) => ({ ...prev, name: '' }))
              }}
              placeholder="e.g. CSV triage assistant"
              aria-invalid={fieldErrors.name ? 'true' : 'false'}
            />
          </Field>
          {fieldErrors.name && <Text>{fieldErrors.name}</Text>}
          <Field label="Description">
            <Input
              data-testid="workbench-agent-description-input"
              value={formData.description}
              onChange={(_, data) => setFormData((prev) => ({ ...prev, description: data.value }))}
              placeholder="optional"
            />
          </Field>
          <Checkbox
            data-testid="workbench-agent-requires-input-checkbox"
            label="Require input?"
            checked={formData.requiresInput}
            onChange={(_, data) => {
              const checked = Boolean(data.checked)
              setFormData((prev) => ({
                ...prev,
                requiresInput: checked,
                requiredInputDescription: checked ? prev.requiredInputDescription : '',
              }))
              setFieldErrors((prev) => ({ ...prev, requiredInputDescription: '' }))
            }}
          />
          <Checkbox
            data-testid="workbench-agent-show-in-menu-checkbox"
            label="Show in menu"
            checked={formData.showInMenu}
            onChange={(_, data) => setFormData((prev) => ({ ...prev, showInMenu: Boolean(data.checked) }))}
          />
          {formData.requiresInput && (
            <>
              <Field label="Input description" required>
                <Input
                  data-testid="workbench-agent-required-input-description"
                  value={formData.requiredInputDescription}
                  onChange={(_, data) => {
                    setFormData((prev) => ({ ...prev, requiredInputDescription: data.value }))
                    setFieldErrors((prev) => ({ ...prev, requiredInputDescription: '' }))
                  }}
                  placeholder="e.g. Ticket INC number"
                  aria-invalid={fieldErrors.requiredInputDescription ? 'true' : 'false'}
                />
              </Field>
              {fieldErrors.requiredInputDescription && <Text>{fieldErrors.requiredInputDescription}</Text>}
            </>
          )}
          <Field label="System prompt" required>
            <Textarea
              data-testid="workbench-agent-system-prompt-input"
              resize="vertical"
              rows={6}
              value={formData.systemPrompt}
              onChange={(_, data) => {
                setFormData((prev) => ({ ...prev, systemPrompt: data.value }))
                setFieldErrors((prev) => ({ ...prev, systemPrompt: '' }))
              }}
              placeholder="Use csv_ticket_stats and explain findings."
              aria-invalid={fieldErrors.systemPrompt ? 'true' : 'false'}
            />
          </Field>
          {fieldErrors.systemPrompt && <Text>{fieldErrors.systemPrompt}</Text>}
          <Field label="Model">
            <Dropdown
              data-testid="workbench-agent-model-select"
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
          <Button
            data-testid="workbench-improve-prompt-button"
            disabled={improvingPrompt || !formData.systemPrompt.trim()}
            onClick={handleImprovePrompt}
          >
            {improvingPrompt ? '✨ Improving...' : '✨ Improve my Prompt'}
          </Button>
          <Field label="Output schema" hint="Define the structured output format with display widgets">
            <SchemaEditor
              value={outputSchema}
              onChange={setOutputSchema}
            />
          </Field>
          <Button
            data-testid="workbench-suggest-schema-button"
            disabled={suggestingSchema || (!formData.name.trim() && !formData.systemPrompt.trim())}
            onClick={handleSuggestSchemaAndTools}
          >
            {suggestingSchema ? 'Suggesting...' : '✨ Suggest Schema & Tools'}
          </Button>
          <Button
            appearance="primary"
            data-testid={isEditing ? 'workbench-save-agent-button' : 'workbench-create-agent-button'}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitLabel}
          </Button>
        </div>
      </Card>

      <Card>
        <div className={styles.cardBody}>
          <Text weight="semibold">Tools</Text>
          <div className={styles.toolsList}>
            {tools.map((tool) => (
              <Checkbox
                key={tool.name}
                data-testid={`workbench-tool-${tool.name}`}
                label={`${tool.name}${tool.description ? ` — ${tool.description}` : ''}`}
                checked={selectedToolNames.includes(tool.name)}
                onChange={() => toggleTool(tool.name)}
              />
            ))}
          </div>
          {fieldErrors.tools && <Text>{fieldErrors.tools}</Text>}
        </div>
      </Card>
    </div>
  )
}
