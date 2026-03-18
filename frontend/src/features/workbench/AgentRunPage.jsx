/**
 * AgentRunPage — Standalone page for running a specific agent.
 *
 * Shown as a tab when an agent has show_in_menu=true.
 * UI: description, optional input field, run button, output, and run history.
 */

import {
  Badge,
  Button,
  Card,
  Caption1,
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
import { ArrowClockwise24Regular, Dismiss24Regular, Pulse20Regular } from '@fluentui/react-icons'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listAgentRuns, runWorkbenchAgent } from '../../services/api'
import { parseRunOutput } from './outputUtils'
import SchemaRenderer from './SchemaRenderer'

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
    maxWidth: '900px',
    width: '90vw',
    maxHeight: '85vh',
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
  const [runs, setRuns] = useState([])
  const [selectedRun, setSelectedRun] = useState(null)

  const loadRuns = useCallback(async () => {
    if (!agent?.id) return
    try {
      const data = await listAgentRuns(agent.id)
      const sorted = (data.runs || []).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      setRuns(sorted)
    } catch { /* ignore */ }
  }, [agent?.id])

  useEffect(() => { loadRuns() }, [loadRuns])

  if (!agent) {
    return <Spinner label="Loading agent..." />
  }

  const parsedOutput = parseRunOutput(output)

  const handleRun = async () => {
    setError('')
    setOutput(null)

    if (agent.requires_input && !requiredInput.trim()) {
      setError(`Required: ${agent.required_input_description || 'input value'}`)
      return
    }

    setRunning(true)
    try {
      const run = await runWorkbenchAgent(agent.id, {
        inputPrompt: prompt.trim(),
        requiredInputValue: requiredInput.trim(),
      })
      setOutput(run?.output || '(no output)')
      loadRuns()
    } catch (err) {
      setError(err?.message || 'Agent run failed')
    } finally {
      setRunning(false)
    }
  }

  const selectedRunParsed = selectedRun ? parseRunOutput(selectedRun.output) : null

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
              <DialogBody>
                <DialogContent style={{ overflowY: 'auto' }}>
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
                <Button appearance="secondary" onClick={() => setSelectedRun(null)}>Close</Button>
              </DialogActions>
            </>
          )}
        </DialogSurface>
      </Dialog>
    </div>
  )
}
