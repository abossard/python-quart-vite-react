/**
 * RunsSidePanel — Vertical side panel showing agent run history.
 *
 * Displays a scrollable list of runs (newest first) with status badges,
 * and a detail view for the selected run rendered via SchemaRenderer.
 */

import {
  Button,
  Card,
  Divider,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { ArrowClockwise24Regular } from '@fluentui/react-icons'
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
    border: `1px solid transparent`,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
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
  detailSection: {
    flexShrink: 0,
    maxHeight: '45%',
    overflowY: 'auto',
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
    padding: tokens.spacingVerticalM,
  },
  detailCard: {
    padding: tokens.spacingVerticalS,
  },
  empty: {
    padding: tokens.spacingVerticalL,
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
})

/** Format a date string as a relative time label (e.g. "2m ago"). */
function formatRelativeTime(dateStr) {
  if (!dateStr) return ''
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffSec = Math.max(0, Math.floor((now - then) / 1000))

  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

function StatusBadge({ status }) {
  const styles = useStyles()
  if (status === 'completed') {
    return <span className={`${styles.badge} ${styles.badgeCompleted}`}>completed</span>
  }
  if (status === 'failed') {
    return <span className={`${styles.badge} ${styles.badgeFailed}`}>failed</span>
  }
  return (
    <span className={`${styles.badge} ${styles.badgeRunning}`}>
      <Spinner size="extra-tiny" />
      running
    </span>
  )
}

/**
 * RunsSidePanel
 *
 * @param {object[]} props.runs          - Run objects (id, agent_id, status, output, error, created_at, completed_at, agent_snapshot)
 * @param {object[]} props.agents        - Agent objects (to look up names by id)
 * @param {string|null} props.selectedRunId - Currently selected run ID
 * @param {function} props.onSelectRun   - Callback when a run is clicked
 * @param {function} props.onRefresh     - Callback to reload runs
 */
export default function RunsSidePanel({ runs = [], agents = [], selectedRunId, onSelectRun, onRefresh }) {
  const styles = useStyles()

  const agentMap = {}
  for (const a of agents) {
    agentMap[a.id] = a
  }

  const sortedRuns = [...runs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  const selectedRun = selectedRunId ? runs.find((r) => r.id === selectedRunId) : null
  const selectedAgent = selectedRun ? agentMap[selectedRun.agent_id] : null
  const outputSchema = selectedAgent?.output_schema ?? selectedRun?.agent_snapshot?.output_schema ?? null

  return (
    <div className={styles.panel} data-testid="runs-side-panel">
      {/* Header */}
      <div className={styles.header}>
        <Text weight="semibold" size={400}>Runs</Text>
        <Button
          appearance="subtle"
          icon={<ArrowClockwise24Regular />}
          size="small"
          onClick={onRefresh}
          data-testid="runs-panel-refresh"
          title="Refresh runs"
        />
      </div>

      {/* Run list */}
      <div className={styles.runList}>
        {sortedRuns.length === 0 && (
          <Text className={styles.empty} italic>No runs yet</Text>
        )}
        {sortedRuns.map((run) => {
          const agent = agentMap[run.agent_id]
          const isSelected = run.id === selectedRunId
          return (
            <div
              key={run.id}
              className={`${styles.runEntry} ${isSelected ? styles.runEntrySelected : ''}`}
              onClick={() => onSelectRun(run.id)}
              data-testid={`run-entry-${run.id}`}
            >
              <div className={styles.runRow}>
                <span className={styles.agentName}>
                  {agent?.name ?? run.agent_snapshot?.name ?? 'Unknown Agent'}
                </span>
                <span className={styles.timestamp}>{formatRelativeTime(run.created_at)}</span>
              </div>
              <div className={styles.runRow}>
                <StatusBadge status={run.status} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail view */}
      {selectedRun && (
        <div className={styles.detailSection} data-testid={`run-detail-${selectedRun.id}`}>
          <Divider />
          <Text weight="semibold" size={200} block style={{ marginBottom: tokens.spacingVerticalS, marginTop: tokens.spacingVerticalS }}>
            {agentMap[selectedRun.agent_id]?.name ?? selectedRun.agent_snapshot?.name ?? 'Run'} — Result
          </Text>

          {selectedRun.error && (
            <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalS }}>
              <MessageBarBody>{selectedRun.error}</MessageBarBody>
            </MessageBar>
          )}

          {selectedRun.output && (
            <Card className={styles.detailCard}>
              <SchemaRenderer
                data={parseRunOutput(selectedRun.output)}
                schema={outputSchema?.properties ? outputSchema : undefined}
              />
            </Card>
          )}

          {!selectedRun.output && !selectedRun.error && selectedRun.status === 'running' && (
            <Spinner size="small" label="Running…" />
          )}
        </div>
      )}
    </div>
  )
}

/** Parse run output into an object suitable for SchemaRenderer. */
function parseRunOutput(output) {
  if (!output) return null
  if (typeof output !== 'string') return output
  try {
    const parsed = JSON.parse(output)
    if (typeof parsed === 'object' && parsed !== null) return parsed
  } catch { /* not JSON */ }
  // Raw string (markdown) — wrap for SchemaRenderer
  return { message: output }
}

/** Safely parse a JSON string; returns the original value if parsing fails. */
function tryParseJSON(value) {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
