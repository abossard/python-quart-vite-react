/**
 * AgentRunPage — Standalone page for running a specific agent.
 *
 * Shown as a tab when an agent has show_in_menu=true.
 * UI: description, optional input field, run button, output, and run history.
 */

import {
    Badge,
    Button,
    Caption1,
    Card,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Field,
    Spinner,
    Subtitle1,
    Subtitle2,
    Text,
    Textarea,
    Tooltip,
    makeStyles,
    tokens,
} from '@fluentui/react-components'
import { ArrowClockwise24Regular, Chat24Regular, Dismiss24Regular, Pulse20Regular } from '@fluentui/react-icons'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createThreadFromRun, listAgentRuns } from '../../services/api'
import { parseRunOutput } from './outputUtils'
import ConversationPanel from './ConversationPanel'
import SchemaRenderer from './SchemaRenderer'
import useRunManager from './useRunManager'

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  topSection: {
    display: 'flex',
    gap: tokens.spacingHorizontalL,
    alignItems: 'flex-start',
  },
  formPanel: {
    flex: 1,
    maxWidth: '700px',
  },
  outputContainer: {
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground1,
    maxHeight: '500px',
    overflowY: 'auto',
  },
  runsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  runsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  runList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  runEntry: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  runTime: {
    color: tokens.colorNeutralForeground4,
    fontSize: '12px',
    fontFamily: 'monospace',
    minWidth: '70px',
    flexShrink: 0,
  },
  runPrompt: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  dialogSurface: {
    maxWidth: '960px',
    width: 'min(96vw, 960px)',
    maxHeight: '92vh',
    display: 'flex',
    flexDirection: 'column',
  },
  dialogBody: {
    flex: '1 1 auto',
    minHeight: 0,
    overflow: 'hidden',
  },
  dialogContent: {
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
  },
})

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function statusColor(status) {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'truncated') return 'warning'
  return 'informative'
}

export default function AgentRunPage({ agent }) {
  const styles = useStyles()
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const [requiredInput, setRequiredInput] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [output, setOutput] = useState(null)
  const [selectedRun, setSelectedRun] = useState(null)
  const [chatThread, setChatThread] = useState(null)

  const { runs: allRuns, startRun, loadRuns } = useRunManager()

  // Filter runs for this agent
  const runs = allRuns.filter(r => r.agent_id === agent?.id)

  if (!agent) {
    return <Spinner label="Loading agent..." />
  }

  const parsedOutput = parseRunOutput(output)

  // Find the latest completed/truncated run for this agent (for auto-continue)
  const latestCompletedRun = runs.find(r => r.status === 'completed' || r.status === 'truncated') || null

  const handleRun = async () => {
    setError('')
    setOutput(null)
    setChatThread(null)

    if (agent.requires_input && !requiredInput.trim()) {
      setError(`Required: ${agent.required_input_description || 'input value'}`)
      return
    }

    setRunning(true)
    try {
      await startRun(agent.id, {
        inputPrompt: prompt.trim(),
        requiredInputValue: requiredInput.trim(),
      })
      // Output will arrive via SSE → useRunManager. For inline display,
      // we can watch the latest run. For now, clear to show it's running.
    } catch (err) {
      setError(err?.message || 'Agent run failed')
    } finally {
      setRunning(false)
    }
  }

  const selectedRunParsed = selectedRun ? parseRunOutput(selectedRun.output) : null

  const handleContinueInChat = async (run) => {
    try {
      const threadData = await createThreadFromRun(run.id)
      setChatThread({
        threadId: threadData.id,
        messages: (threadData.messages || []).map(m => ({
          role: m.role,
          content: m.content,
          id: m.id,
        })),
      })
      setSelectedRun(null)
    } catch (err) {
      console.error('Failed to create thread from run:', err)
    }
  }

  return (
    <div className={styles.container}>
      <div>
        <Subtitle1 data-testid="agent-run-page-title">{agent.name}</Subtitle1>
        {agent.description && <Text>{agent.description}</Text>}
      </div>

      <div className={styles.topSection}>
        <div className={styles.formPanel}>
          <Card>
            {agent.requires_input && (
              <Field label={agent.required_input_description || 'Required input'} required>
                <Textarea
                  data-testid="agent-run-required-input"
                  value={requiredInput}
                  onChange={(_, d) => setRequiredInput(d.value)}
                  rows={1}
                  placeholder={agent.required_input_description}
                />
              </Field>
            )}
            <Field label="Prompt (optional)">
              <Textarea
                data-testid="agent-run-prompt"
                value={prompt}
                onChange={(_, d) => setPrompt(d.value)}
                rows={2}
                placeholder="Additional instructions..."
              />
            </Field>
            <Button
              appearance="primary"
              data-testid="agent-run-button"
              onClick={handleRun}
              disabled={running}
              style={{ marginTop: tokens.spacingVerticalS }}
            >
              {running ? 'Running...' : 'Run'}
            </Button>
            {error && <Text style={{ color: tokens.colorPaletteRedForeground1 }}>{error}</Text>}
          </Card>

          {parsedOutput && (
            <div data-testid="agent-run-output" className={styles.outputContainer} style={{ marginTop: tokens.spacingVerticalM }}>
              <SchemaRenderer
                data={parsedOutput}
                schema={agent.output_schema?.properties ? agent.output_schema : undefined}
              />
            </div>
          )}

          {/* Auto-continue: show "Continue in Chat" after a run completes */}
          {!chatThread && latestCompletedRun && (
            <div style={{ marginTop: tokens.spacingVerticalS, display: 'flex', gap: tokens.spacingHorizontalS }}>
              <Button
                appearance="primary"
                icon={<Chat24Regular />}
                onClick={() => handleContinueInChat(latestCompletedRun)}
                data-testid="agent-run-continue-chat"
              >
                Continue in Chat
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Run History */}
      <div className={styles.runsSection}>
        <div className={styles.runsHeader}>
          <Subtitle2>Run History</Subtitle2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Caption1>{runs.length} run{runs.length !== 1 ? 's' : ''}</Caption1>
            <Button
              appearance="subtle"
              icon={<ArrowClockwise24Regular />}
              size="small"
              onClick={loadRuns}
              data-testid="agent-run-refresh-runs"
              title="Refresh"
            />
          </div>
        </div>

        <Card>
          <div className={styles.runList} data-testid="agent-run-history">
            {runs.length === 0 ? (
              <Text style={{ padding: tokens.spacingVerticalM, color: tokens.colorNeutralForeground4, textAlign: 'center' }}>
                No runs yet — run the agent above to see history here
              </Text>
            ) : (
              runs.map((run) => (
                <div
                  key={run.id}
                  className={styles.runEntry}
                  onClick={() => setSelectedRun(run)}
                  data-testid={`agent-run-entry-${run.id}`}
                >
                  <span className={styles.runTime}>{formatTime(run.created_at)}</span>
                  <Badge appearance="outline" color={statusColor(run.status)} size="small">
                    {run.status}
                  </Badge>
                  <span className={styles.runPrompt}>
                    {run.input_prompt || run.agent_snapshot?.composed_user_message?.slice(0, 80) || '(no prompt)'}
                  </span>
                  {run.tools_used?.length > 0 && (
                    <Caption1>{run.tools_used.length} tool{run.tools_used.length !== 1 ? 's' : ''}</Caption1>
                  )}
                  <Tooltip content="View in Activity" relationship="label">
                    <Button
                      appearance="subtle"
                      icon={<Pulse20Regular />}
                      size="small"
                      onClick={(e) => { e.stopPropagation(); navigate(`/activity?run_id=${run.id}`) }}
                      data-testid={`agent-run-activity-${run.id}`}
                    />
                  </Tooltip>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Run Detail Dialog */}
      <Dialog
        open={Boolean(selectedRun)}
        onOpenChange={(_, data) => { if (!data.open) setSelectedRun(null) }}
      >
        <DialogSurface className={styles.dialogSurface}>
          {selectedRun && (
            <>
              <DialogTitle
                action={
                  <Button appearance="subtle" icon={<Dismiss24Regular />} onClick={() => setSelectedRun(null)} />
                }
              >
                Run Result — {formatTime(selectedRun.created_at)}
              </DialogTitle>
              <DialogBody className={styles.dialogBody}>
                <DialogContent className={styles.dialogContent}>
                  {selectedRun.error && (
                    <Text style={{ color: tokens.colorPaletteRedForeground1, marginBottom: tokens.spacingVerticalM, display: 'block' }}>
                      Error: {selectedRun.error}
                    </Text>
                  )}
                  {selectedRunParsed ? (
                    <SchemaRenderer
                      data={selectedRunParsed}
                      schema={agent.output_schema?.properties ? agent.output_schema : undefined}
                    />
                  ) : (
                    <Text italic>No output</Text>
                  )}
                </DialogContent>
              </DialogBody>
              <DialogActions>
                <Button
                  appearance="primary"
                  icon={<Chat24Regular />}
                  onClick={() => handleContinueInChat(selectedRun)}
                  data-testid="continue-in-chat-button"
                >
                  Continue in Chat
                </Button>
                <Button appearance="secondary" onClick={() => setSelectedRun(null)}>Close</Button>
              </DialogActions>
            </>
          )}
        </DialogSurface>
      </Dialog>

      {/* Chat Panel (opened from Continue in Chat) */}
      {chatThread && (
        <div style={{ height: '500px', marginTop: tokens.spacingVerticalL }}>
          <ConversationPanel
            agentId={agent.id}
            agentName={agent.name}
            threadId={chatThread.threadId}
            initialMessages={chatThread.messages}
            outputSchema={agent.output_schema}
            onClose={() => setChatThread(null)}
          />
        </div>
      )}
    </div>
  )
}
