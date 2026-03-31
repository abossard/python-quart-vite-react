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
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    deleteWorkbenchAgent,
    getWorkbenchUiConfig,
    listWorkbenchAgents,
    listWorkbenchTools,
} from '../../services/api'
import AgentCardsPanel from './AgentCardsPanel'
import AgentCreateForm from './AgentCreateForm'
import AgentEditDialog from './AgentEditDialog'
import RunConversationModal from './RunConversationModal'
import RunsSidePanel from './RunsSidePanel'
import useRunManager from './useRunManager'

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
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [activeTab, setActiveTab] = useState('agents')
  const [editingAgent, setEditingAgent] = useState(null)

  // Central run manager — single source of truth
  const {
    runs,
    startRun,
    loadRuns,
    clearAllRuns,
    getRunActivity,
    getRunState,
  } = useRunManager()

  const agentMap = useMemo(() => {
    const map = {}
    for (const a of agents) map[a.id] = a
    return map
  }, [agents])

  const selectedRun = selectedRunId ? runs.find(r => r.id === selectedRunId) : null
  const selectedAgent = selectedRun ? agentMap[selectedRun.agent_id] : null

  const loadData = useCallback(async () => {
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
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleRunStarted = useCallback(async (agentId, opts) => {
    try {
      const run = await startRun(agentId, opts)
      setSelectedRunId(run.id)
    } catch (err) {
      setError(err?.message || 'Failed to start run')
    }
  }, [startRun])

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
              onRefresh={loadRuns}
              onDeleteAll={clearAllRuns}
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

      {/* Unified Run Conversation Modal */}
      <RunConversationModal
        open={Boolean(selectedRun)}
        run={selectedRun}
        agentId={selectedAgent?.id || selectedRun?.agent_id}
        agentName={selectedAgent?.name || selectedRun?.agent_snapshot?.name || 'Agent'}
        outputSchema={selectedAgent?.output_schema}
        activityEvents={selectedRunId ? getRunActivity(selectedRunId) : []}
        runState={selectedRunId ? getRunState(selectedRunId) : null}
        onClose={() => setSelectedRunId(null)}
      />
    </div>
  )
}
