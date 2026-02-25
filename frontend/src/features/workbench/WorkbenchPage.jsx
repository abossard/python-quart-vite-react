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
  const [selectedToolNames, setSelectedToolNames] = useState([])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [configPayload, toolsPayload, agentsPayload] = await Promise.all([
        getWorkbenchUiConfig(),
        listWorkbenchTools(),
        listWorkbenchAgents(),
      ])
      setUiConfig(configPayload)
      setTools(toolsPayload.tools || [])
      setAgents(agentsPayload.agents || [])
    } catch (err) {
      setError(err?.message || 'Failed to load workbench data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const toggleTool = (toolName) => {
    setSelectedToolNames((prev) => (
      prev.includes(toolName)
        ? prev.filter((item) => item !== toolName)
        : [...prev, toolName]
    ))
  }

  const handleCreateAgent = async () => {
    setError('')
    setNotice('')

    if (!formData.name.trim() || !formData.systemPrompt.trim()) {
      setError('Name and system prompt are required')
      return
    }
    if (selectedToolNames.length === 0) {
      setError('Select at least one tool')
      return
    }

    setSubmitting(true)
    try {
      await createWorkbenchAgent({
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
      setAgents((prev) => prev.filter((agent) => agent.id !== agentId))
      setNotice('Agent deleted')
    } catch (err) {
      setError(err?.message || 'Failed to delete agent')
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <Spinner label="Loading Agent Workbench..." />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div>
        <Subtitle1 data-testid="workbench-page-title">Agent Workbench</Subtitle1>
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
                onChange={(_, data) => setFormData((prev) => ({ ...prev, name: data.value }))}
                placeholder="e.g. CSV triage assistant"
              />
            </Field>
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
                onChange={(_, data) => setFormData((prev) => ({ ...prev, systemPrompt: data.value }))}
                placeholder="Use csv_ticket_stats and explain findings."
              />
            </Field>
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
          </div>
        </Card>
      </div>

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
