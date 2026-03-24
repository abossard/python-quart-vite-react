import {
    Caption1,
    Spinner,
    Subtitle1,
    Tab,
    TabList,
    Text,
    makeStyles,
    tokens,
} from '@fluentui/react-components'
import { Add24Regular, Apps24Regular } from '@fluentui/react-icons'
import { useCallback, useEffect, useState } from 'react'
import {
    deleteAllRuns,
    deleteWorkbenchAgent,
    getWorkbenchUiConfig,
    listAllRuns,
    listWorkbenchAgents,
    listWorkbenchTools,
} from '../../services/api'
import AgentCardsPanel from './AgentCardsPanel'
import AgentCreateForm from './AgentCreateForm'
import AgentEditDialog from './AgentEditDialog'
import RunsSidePanel from './RunsSidePanel'

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  agentsLayout: {
    display: 'flex',
    gap: tokens.spacingHorizontalL,
    alignItems: 'stretch',
    minHeight: '500px',
  },
  agentsMain: {
    flex: 1,
    minWidth: 0,
  },
  runsPanel: {
    width: '340px',
    flexShrink: 0,
  },
})

export default function WorkbenchPage() {
  const styles = useStyles()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uiConfig, setUiConfig] = useState(null)
  const [tools, setTools] = useState([])
  const [agents, setAgents] = useState([])
  const [runs, setRuns] = useState([])
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [activeTab, setActiveTab] = useState('agents')
  const [editingAgent, setEditingAgent] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [configPayload, toolsPayload, agentsPayload, runsPayload] = await Promise.all([
        getWorkbenchUiConfig(),
        listWorkbenchTools(),
        listWorkbenchAgents(),
        listAllRuns().catch(() => ({ runs: [] })),
      ])
      setUiConfig(configPayload)
      setTools(toolsPayload.tools || [])
      setAgents(agentsPayload.agents || [])
      setRuns(runsPayload.runs || [])
    } catch (err) {
      setError(err?.message || 'Failed to load workbench data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const refreshRuns = useCallback(async () => {
    try {
      const runsPayload = await listAllRuns()
      setRuns(runsPayload.runs || [])
    } catch { /* ignore */ }
  }, [])

  const handleDeleteAllRuns = useCallback(async () => {
    try {
      await deleteAllRuns()
      setRuns([])
      setSelectedRunId(null)
    } catch { /* ignore */ }
  }, [])

  const handleRunStarted = useCallback((run) => {
    setRuns((prev) => [run, ...prev])
    setSelectedRunId(run.id)
  }, [])

  const handleAgentCreated = useCallback(async () => {
    const agentsPayload = await listWorkbenchAgents()
    setAgents(agentsPayload.agents || [])
    setActiveTab('agents')
  }, [])

  const handleDeleteAgent = useCallback(async (agentId) => {
    try {
      await deleteWorkbenchAgent(agentId)
      setAgents((prev) => prev.filter((a) => a.id !== agentId))
    } catch (err) {
      setError(err?.message || 'Failed to delete agent')
    }
  }, [])

  const handleAgentSaved = useCallback(async () => {
    try {
      const agentsPayload = await listWorkbenchAgents()
      setAgents(agentsPayload.agents || [])
    } catch (err) {
      setError(err?.message || 'Failed to refresh agents')
    }
  }, [])

  if (loading) {
    return (
      <div className={styles.container}>
        <Spinner label="Loading Agent Fabric..." />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <Subtitle1 data-testid="workbench-page-title">Agent Fabric</Subtitle1>
          <Caption1>
            {' '}Create, run, and manage AI agents.
            {' '}Endpoints: {uiConfig?.endpoints?.length ?? 0}
          </Caption1>
        </div>
      </div>

      {error && <Text style={{ color: tokens.colorPaletteRedForeground1 }}>{error}</Text>}

      <TabList
        selectedValue={activeTab}
        onTabSelect={(_, data) => setActiveTab(data.value)}
        data-testid="workbench-tabs"
      >
        <Tab value="agents" icon={<Apps24Regular />} data-testid="workbench-tab-agents">
          Agents ({agents.length})
        </Tab>
        <Tab value="create" icon={<Add24Regular />} data-testid="workbench-tab-create">
          Create Agent
        </Tab>
      </TabList>

      {activeTab === 'agents' && (
        <div className={styles.agentsLayout}>
          <div className={styles.agentsMain}>
            {agents.length === 0 ? (
              <Text>No agents yet. Create one to get started.</Text>
            ) : (
              <AgentCardsPanel
                agents={agents}
                onEdit={setEditingAgent}
                onDelete={handleDeleteAgent}
                onRunStarted={handleRunStarted}
                onRefresh={loadData}
              />
            )}
          </div>
          <div className={styles.runsPanel}>
            <RunsSidePanel
              runs={runs}
              agents={agents}
              selectedRunId={selectedRunId}
              onSelectRun={setSelectedRunId}
              onRefresh={refreshRuns}
              onDeleteAll={handleDeleteAllRuns}
            />
          </div>
        </div>
      )}

      {activeTab === 'create' && (
        <AgentCreateForm
          tools={tools}
          onAgentCreated={handleAgentCreated}
          modelOptions={uiConfig?.llm?.available_models || []}
          serviceDefaultModel={uiConfig?.llm?.default_model || ''}
        />
      )}

      <AgentEditDialog
        agent={editingAgent}
        tools={tools}
        modelOptions={uiConfig?.llm?.available_models || []}
        serviceDefaultModel={uiConfig?.llm?.default_model || ''}
        onSave={handleAgentSaved}
        onClose={() => setEditingAgent(null)}
      />
    </div>
  )
}
