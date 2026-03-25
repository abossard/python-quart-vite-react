/**
 * RunsSidePanel — Side panel with run history list.
 * Clicking a run opens a full-width Dialog with the rendered result.
 *
 * Calculations (pure): buildAgentMap, sortRunsNewestFirst, resolveOutputSchema,
 *   resolveAgentName, parseRunOutput, formatRelativeTime
 * Actions (side effects): rendering, event callbacks
 */

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { ArrowClockwise24Regular, Delete24Regular, Dismiss24Regular } from '@fluentui/react-icons'
import { parseRunOutput } from './outputUtils'
import SchemaRenderer from './SchemaRenderer'

const useStyles = makeStyles({
  panel: {
    width: '320px',
    minWidth: '320px',
    display: 'flex',
    flexDirection: 'column',
    borderLeft: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground2,
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    flexShrink: 0,
  },
  runList: {
    flex: '1 1 0',
    overflowY: 'auto',
    padding: tokens.spacingVerticalXS,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  runEntry: {
    cursor: 'pointer',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    border: '1px solid transparent',
    '&:hover': { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  runEntrySelected: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
    border: `1px solid ${tokens.colorBrandStroke1}`,
  },
  runRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  agentName: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '180px',
  },
  timestamp: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    whiteSpace: 'nowrap',
  },
  badge: {
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    padding: '1px 6px',
    borderRadius: tokens.borderRadiusCircular,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  badgeCompleted: {
    backgroundColor: tokens.colorPaletteGreenBackground2,
    color: tokens.colorPaletteGreenForeground2,
  },
  badgeFailed: {
    backgroundColor: tokens.colorPaletteRedBackground2,
    color: tokens.colorPaletteRedForeground2,
  },
  badgeRunning: {
    backgroundColor: tokens.colorPaletteBlueBorderActive,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  empty: {
    padding: tokens.spacingVerticalL,
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
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

// ============================================================================
// CALCULATIONS (pure — no side effects)
// ============================================================================

function buildAgentMap(agents) {
  const map = {}
  for (const a of agents) map[a.id] = a
  return map
}

function sortRunsNewestFirst(runs) {
  return [...runs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}

function resolveOutputSchema(agent, run) {
  const agentSchema = agent?.output_schema
  if (agentSchema && agentSchema.properties) return agentSchema
  const snapshotSchema = run?.agent_snapshot?.output_schema
  if (snapshotSchema && snapshotSchema.properties) return snapshotSchema
  return null
}

function resolveAgentName(agentMap, run) {
  return agentMap[run.agent_id]?.name ?? run.agent_snapshot?.name ?? 'Unknown Agent'
}

function formatRelativeTime(dateStr, now = Date.now()) {
  if (!dateStr) return ''
  const diffSec = Math.max(0, Math.floor((now - new Date(dateStr).getTime()) / 1000))
  if (diffSec < 60) return `${diffSec}s ago`
  const m = Math.floor(diffSec / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ============================================================================
// COMPONENTS (actions — render UI)
// ============================================================================

function StatusBadge({ status }) {
  const styles = useStyles()
  if (status === 'completed')
    return <span className={`${styles.badge} ${styles.badgeCompleted}`}>completed</span>
  if (status === 'failed')
    return <span className={`${styles.badge} ${styles.badgeFailed}`}>failed</span>
  return (
    <span className={`${styles.badge} ${styles.badgeRunning}`}>
      <Spinner size="extra-tiny" /> running
    </span>
  )
}

export default function RunsSidePanel({ runs = [], agents = [], selectedRunId, onSelectRun, onRefresh, onDeleteAll }) {
  const styles = useStyles()

  const agentMap = buildAgentMap(agents)
  const sortedRuns = sortRunsNewestFirst(runs)
  const selectedRun = selectedRunId ? runs.find((r) => r.id === selectedRunId) : null
  const outputSchema = resolveOutputSchema(
    selectedRun ? agentMap[selectedRun.agent_id] : null,
    selectedRun,
  )

  return (
    <>
      <div className={styles.panel} data-testid="runs-side-panel">
        <div className={styles.header}>
          <Text weight="semibold" size={400}>Runs</Text>
          <div style={{ display: 'flex', gap: '4px' }}>
            {sortedRuns.length > 0 && (
              <Button
                appearance="subtle"
                icon={<Delete24Regular />}
                size="small"
                onClick={onDeleteAll}
                data-testid="runs-panel-delete-all"
                title="Delete all runs"
              />
            )}
            <Button
              appearance="subtle"
              icon={<ArrowClockwise24Regular />}
              size="small"
              onClick={onRefresh}
              data-testid="runs-panel-refresh"
              title="Refresh runs"
            />
          </div>
        </div>

        <div className={styles.runList}>
          {sortedRuns.length === 0 && (
            <Text className={styles.empty} italic>No runs yet</Text>
          )}
          {sortedRuns.map((run) => {
            const isSelected = run.id === selectedRunId
            return (
              <div
                key={run.id}
                className={`${styles.runEntry} ${isSelected ? styles.runEntrySelected : ''}`}
                onClick={() => onSelectRun(run.id)}
                data-testid={`run-entry-${run.id}`}
              >
                <div className={styles.runRow}>
                  <span className={styles.agentName}>{resolveAgentName(agentMap, run)}</span>
                  <span className={styles.timestamp}>{formatRelativeTime(run.created_at)}</span>
                </div>
                <div className={styles.runRow}>
                  <StatusBadge status={run.status} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Result Dialog — full width modal when a run is clicked */}
      <Dialog
        open={Boolean(selectedRun)}
        onOpenChange={(_, data) => { if (!data.open) onSelectRun(null) }}
      >
        <DialogSurface className={styles.dialogSurface}>
          {selectedRun && (
            <>
              <DialogTitle
                action={
                  <Button appearance="subtle" icon={<Dismiss24Regular />} onClick={() => onSelectRun(null)} />
                }
              >
                {resolveAgentName(agentMap, selectedRun)} — Result
              </DialogTitle>
              <DialogBody className={styles.dialogBody}>
                <DialogContent className={styles.dialogContent}>
                  <div data-testid={`run-detail-${selectedRun.id}`}>
                    {selectedRun.error && (
                      <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalM }}>
                        <MessageBarBody>{selectedRun.error}</MessageBarBody>
                      </MessageBar>
                    )}
                    {selectedRun.output && (
                      <SchemaRenderer
                        data={parseRunOutput(selectedRun.output)}
                        schema={outputSchema || undefined}
                      />
                    )}
                    {!selectedRun.output && !selectedRun.error && selectedRun.status === 'running' && (
                      <Spinner size="medium" label="Running…" />
                    )}
                    {!selectedRun.output && !selectedRun.error && selectedRun.status !== 'running' && (
                      <Text italic>No output</Text>
                    )}
                  </div>
                </DialogContent>
              </DialogBody>
              <DialogActions>
                <Button appearance="secondary" onClick={() => onSelectRun(null)}>Close</Button>
              </DialogActions>
            </>
          )}
        </DialogSurface>
      </Dialog>
    </>
  )
}
