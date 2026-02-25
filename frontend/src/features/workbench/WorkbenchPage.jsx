import {
  Button,
  Caption1,
  Card,
  Checkbox,
  Field,
  Input,
  Spinner,
  Subtitle1,
  Text,
  Textarea,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { useEffect, useState } from 'react'
import {
  createWorkbenchAgent,
  deleteWorkbenchAgent,
  getWorkbenchUiConfig,
  listWorkbenchAgents,
  listWorkbenchTools,
  runWorkbenchAgent,
} from '../../services/api'

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingHorizontalL,
    alignItems: 'start',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  toolsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    maxHeight: '260px',
    overflowY: 'auto',
    padding: `${tokens.spacingVerticalXS} 0`,
  },
  tableWrapper: {
    overflowX: 'auto',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
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
    whiteSpace: 'nowrap',
  },
  td: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    verticalAlign: 'top',
  },
  empty: {
    padding: tokens.spacingVerticalL,
  },
  select: {
    width: '100%',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
  },
})

export default function WorkbenchPage() {
  const styles = useStyles()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [uiConfig, setUiConfig] = useState(null)
  const [tools, setTools] = useState([])
  const [agents, setAgents] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    systemPrompt: '',
  })
  const [fieldErrors, setFieldErrors] = useState({
    name: '',
    systemPrompt: '',
    tools: '',
  })
  const [selectedToolNames, setSelectedToolNames] = useState([])
  const [runForm, setRunForm] = useState({
    agentId: '',
    prompt: '',
  })
  const [runFieldErrors, setRunFieldErrors] = useState({
    agentId: '',
    prompt: '',
  })
  const [runError, setRunError] = useState('')
  const [runOutput, setRunOutput] = useState('')
  const [runButtonOutput, setRunButtonOutput] = useState('')
  const [isRunningAgent, setIsRunningAgent] = useState(false)
  const [runPulse, setRunPulse] = useState(0)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [configPayload, toolsPayload, agentsPayload] = await Promise.all([
        getWorkbenchUiConfig(),
        listWorkbenchTools(),
        listWorkbenchAgents(),
      ])
      const nextTools = toolsPayload.tools || []
      const nextAgents = agentsPayload.agents || []

      setUiConfig(configPayload)
      setTools(nextTools)
      setAgents(nextAgents)
      setSelectedToolNames((prev) => {
        const availableNames = nextTools.map((tool) => tool.name)
        if (prev.length === 0) {
          return availableNames
        }
        const filtered = prev.filter((name) => availableNames.includes(name))
        return filtered.length > 0 ? filtered : availableNames
      })
      setRunForm((prev) => ({
        ...prev,
        agentId: (
          prev.agentId && nextAgents.some((agent) => agent.id === prev.agentId)
            ? prev.agentId
            : (nextAgents[0]?.id || '')
        ),
      }))
    } catch (err) {
      setError(err?.message || 'Failed to load workbench data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!isRunningAgent) {
      setRunPulse(0)
      return undefined
    }

    const timer = setInterval(() => {
      setRunPulse((prev) => (prev + 1) % 4)
    }, 350)
    return () => clearInterval(timer)
  }, [isRunningAgent])

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
    }
    if (!formData.name.trim()) {
      nextErrors.name = 'Agent name is required'
    }
    if (!formData.systemPrompt.trim()) {
      nextErrors.systemPrompt = 'System prompt is required'
    }
    if (selectedToolNames.length === 0) {
      nextErrors.tools = 'Select at least one tool'
    }
    setFieldErrors(nextErrors)
    return !nextErrors.name && !nextErrors.systemPrompt && !nextErrors.tools
  }

  const validateRunForm = () => {
    const nextErrors = {
      agentId: '',
      prompt: '',
    }
    if (!runForm.agentId) {
      nextErrors.agentId = 'Select an agent'
    }
    if (!runForm.prompt.trim()) {
      nextErrors.prompt = 'Run prompt is required'
    }
    setRunFieldErrors(nextErrors)
    return !nextErrors.agentId && !nextErrors.prompt
  }

  const handleCreateAgent = async () => {
    setError('')
    setNotice('')
    if (!validateForm()) {
      return
    }

    setSubmitting(true)
    try {
      const createdAgent = await createWorkbenchAgent({
        name: formData.name.trim(),
        description: formData.description.trim(),
        system_prompt: formData.systemPrompt.trim(),
        tool_names: selectedToolNames,
        success_criteria: [],
      })

      const agentsPayload = await listWorkbenchAgents()
      setAgents(agentsPayload.agents || [])
      setFormData({
        name: '',
        description: '',
        systemPrompt: '',
      })
      setRunForm((prev) => ({
        ...prev,
        agentId: createdAgent?.id || prev.agentId,
      }))
      setFieldErrors({
        name: '',
        systemPrompt: '',
        tools: '',
      })
      setNotice('Agent created')
    } catch (err) {
      setError(err?.message || 'Failed to create agent')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteAgent = async (agentId) => {
    setError('')
    setNotice('')
    try {
      await deleteWorkbenchAgent(agentId)
      setAgents((prev) => {
        const nextAgents = prev.filter((agent) => agent.id !== agentId)
        setRunForm((current) => ({
          ...current,
          agentId: current.agentId === agentId ? (nextAgents[0]?.id || '') : current.agentId,
        }))
        return nextAgents
      })
      setNotice('Agent deleted')
    } catch (err) {
      setError(err?.message || 'Failed to delete agent')
    }
  }

  const handleRunAgent = async () => {
    setRunError('')
    setRunOutput('')
    setRunButtonOutput('')
    if (!validateRunForm()) {
      return
    }

    setIsRunningAgent(true)
    try {
      const run = await runWorkbenchAgent(runForm.agentId, runForm.prompt.trim())
      const output = typeof run?.output === 'string' ? run.output : ''
      setRunOutput(output || '(no output)')

      const preview = output.replace(/\s+/g, ' ').trim().slice(0, 90)
      if (!preview) {
        setRunButtonOutput('completed')
      } else {
        for (let index = 1; index <= preview.length; index += 3) {
          setRunButtonOutput(preview.slice(0, index))
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, 14))
        }
      }
    } catch (err) {
      setRunError(err?.message || 'Failed to run agent')
    } finally {
      setIsRunningAgent(false)
    }
  }

  const runButtonLabel = isRunningAgent
    ? (
      runButtonOutput
        ? `Running: ${runButtonOutput}`
        : `Running${'.'.repeat(runPulse)}`
    )
    : (
      runButtonOutput
        ? `Last output: ${runButtonOutput}`
        : 'Run Agent'
    )

  if (loading) {
    return (
      <div className={styles.container}>
        <Spinner label="Loading Agent Fabric..." />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div>
        <Subtitle1 data-testid="workbench-page-title">Agent Fabric</Subtitle1>
        <Caption1>
          Minimal technical UI for agent definitions and lifecycle.
          {' '}
          Endpoints:
          {' '}
          {uiConfig?.endpoints?.length ?? 0}
        </Caption1>
      </div>

      {error && <Text>{error}</Text>}
      {notice && <Text>{notice}</Text>}

      <div className={styles.cardsGrid}>
        <Card>
          <div className={styles.cardBody}>
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
            <Button
              appearance="primary"
              data-testid="workbench-create-agent-button"
              onClick={handleCreateAgent}
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Agent'}
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

      <Card>
        <div className={styles.cardBody}>
          <Text weight="semibold">Run Agent</Text>
          <Field label="Agent" required>
            <select
              className={styles.select}
              data-testid="workbench-run-agent-select"
              value={runForm.agentId}
              onChange={(event) => {
                const value = event.target.value
                setRunForm((prev) => ({ ...prev, agentId: value }))
                setRunFieldErrors((prev) => ({ ...prev, agentId: '' }))
              }}
              aria-invalid={runFieldErrors.agentId ? 'true' : 'false'}
            >
              <option value="">Select an agent</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </Field>
          {runFieldErrors.agentId && <Text>{runFieldErrors.agentId}</Text>}

          <Field label="Run prompt" required>
            <Textarea
              data-testid="workbench-run-prompt-input"
              resize="vertical"
              rows={4}
              value={runForm.prompt}
              onChange={(_, data) => {
                setRunForm((prev) => ({ ...prev, prompt: data.value }))
                setRunFieldErrors((prev) => ({ ...prev, prompt: '' }))
              }}
              placeholder="Summarize open high-priority ticket trends."
              aria-invalid={runFieldErrors.prompt ? 'true' : 'false'}
            />
          </Field>
          {runFieldErrors.prompt && <Text>{runFieldErrors.prompt}</Text>}

          <Button
            appearance="primary"
            data-testid="workbench-run-agent-button"
            onClick={handleRunAgent}
            disabled={isRunningAgent || agents.length === 0}
          >
            {runButtonLabel}
          </Button>

          {runError && <Text data-testid="workbench-run-error">{runError}</Text>}
          {runOutput && (
            <Field label="Run output">
              <Textarea
                data-testid="workbench-run-output"
                value={runOutput}
                readOnly
                resize="vertical"
                rows={6}
              />
            </Field>
          )}
        </div>
      </Card>

      <Card>
        <div className={styles.cardBody}>
          <Text weight="semibold">Agents ({agents.length})</Text>
          <div className={styles.tableWrapper}>
            {agents.length === 0 ? (
              <div className={styles.empty}>
                <Text>No agents yet.</Text>
              </div>
            ) : (
              <table className={styles.table} data-testid="workbench-agents-table">
                <thead>
                  <tr>
                    <th className={styles.th}>Name</th>
                    <th className={styles.th}>Tools</th>
                    <th className={styles.th}>Updated</th>
                    <th className={styles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr key={agent.id}>
                      <td className={styles.td}>
                        <Text weight="semibold">{agent.name}</Text>
                        <br />
                        <Caption1>{agent.id}</Caption1>
                      </td>
                      <td className={styles.td}>
                        {(agent.tool_names || []).join(', ') || '—'}
                      </td>
                      <td className={styles.td}>{agent.updated_at || '—'}</td>
                      <td className={styles.td}>
                        <Button
                          size="small"
                          appearance="subtle"
                          onClick={() => handleDeleteAgent(agent.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
