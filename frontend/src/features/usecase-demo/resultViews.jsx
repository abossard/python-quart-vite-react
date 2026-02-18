import {
  Badge,
  Button,
  Checkbox,
  Spinner,
  Text,
  ToolbarButton,
  Tooltip,
  makeStyles,
  tokens
} from '@fluentui/react-components'
import {
  ArrowUp24Regular,
  CheckmarkCircle24Regular,
  DismissCircle24Regular,
  Mail24Regular,
  SelectAllOn24Regular,
  Warning24Regular,
} from '@fluentui/react-icons'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getSlaBreach } from '../../services/api'

function ResultTableView({ run, styles }) {
  const hasRows = Boolean(run?.result_rows?.length && run?.result_columns?.length)
  if (!hasRows) {
    return <Text>No structured table rows were found in this run.</Text>
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {run.result_columns.map((column) => (
              <th key={column} className={styles.th}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {run.result_rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 ? styles.rowAlt : ''}>
              {run.result_columns.map((column) => (
                <td key={`${rowIndex}-${column}`} className={styles.td}>
                  {String(row[column] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ResultMarkdownView({ markdown, styles }) {
  if (!markdown) {
    return <Text>No narrative summary was returned for this run.</Text>
  }

  return (
    <div className={styles.markdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {markdown}
      </ReactMarkdown>
    </div>
  )
}

const BREACH_COLORS = {
  breached: { bg: '#fde7e9', border: '#d13438', text: '#a80000', label: 'Breached', icon: DismissCircle24Regular },
  at_risk:  { bg: '#fff4ce', border: '#f7630c', text: '#bc4b00', label: 'At Risk',  icon: Warning24Regular },
  ok:       { bg: '#dff6dd', border: '#107c10', text: '#0b6a0b', label: 'OK',       icon: CheckmarkCircle24Regular },
  unknown:  { bg: '#f5f5f5', border: '#8a8886', text: '#605e5c', label: '—',        icon: null },
}

const PRIORITY_COLORS = {
  critical: { bg: '#fde7e9', color: '#a80000' },
  high:     { bg: '#fff4ce', color: '#bc4b00' },
  medium:   { bg: '#e8f4fd', color: '#0063b1' },
  low:      { bg: '#f5f5f5', color: '#605e5c' },
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function AgeBar({ ageHours, thresholdHours }) {
  const pct = Math.min((ageHours / thresholdHours) * 100, 100)
  const color = pct >= 100 ? '#d13438' : pct >= 75 ? '#f7630c' : '#107c10'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 80 }}>
      <Text size={100} style={{ color }}>{ageHours}h / {thresholdHours}h</Text>
      <div style={{ height: 5, borderRadius: 3, background: '#e0e0e0', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

const useSlaStyles = makeStyles({
  wrapper: {
    display: 'grid',
    gap: tokens.spacingVerticalM,
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: tokens.spacingHorizontalM,
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    gap: tokens.spacingVerticalXS,
    textAlign: 'center',
  },
  statNum: {
    fontSize: '2rem',
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: 1,
  },
  refTime: {
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
  },
  actionBar: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    flexWrap: 'wrap',
  },
  selectionInfo: {
    marginLeft: 'auto',
    color: tokens.colorNeutralForeground3,
  },
  tableWrap: {
    overflowX: 'auto',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `2px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground3,
    whiteSpace: 'nowrap',
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  td: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    verticalAlign: 'middle',
  },
  groupHeader: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
})

const SLA_COLUMNS = [
  { key: 'ticket_id',           label: 'Ticket' },
  { key: 'priority',            label: 'Priority' },
  { key: 'urgency',             label: 'Urgency' },
  { key: 'assigned_group',      label: 'Assigned Group' },
  { key: 'reported_date',       label: 'Reported' },
  { key: 'age_progress',        label: 'Age vs SLA' },
]

function SlaBreachResultView() {
  const slaStyles = useSlaStyles()
  const [selected, setSelected] = useState(new Set())
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getSlaBreach()
      .then((data) => { if (!cancelled) { setReport(data); setLoading(false) } })
      .catch((err) => { if (!cancelled) { setFetchError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  const rows = report?.tickets ?? []
  // server already returns rows sorted: breached → at_risk, age_hours desc

  const allIds = useMemo(() => rows.map((r) => r.ticket_id), [rows])
  const allSelected = rows.length > 0 && selected.size === rows.length

  const toggleAll = useCallback(() => {
    setSelected((prev) => prev.size === allIds.length ? new Set() : new Set(allIds))
  }, [allIds])

  const toggleOne = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  if (loading) return <Spinner size="small" label="Loading SLA data..." />
  if (fetchError) return <Text style={{ color: '#d13438' }}>Failed to load: {fetchError}</Text>
  if (!rows.length) return <Text>No at-risk or breached tickets found.</Text>

  const selectedCount = selected.size
  const breachedCount = report?.total_breached ?? 0
  const atRiskCount = report?.total_at_risk ?? 0
  const totalCount = rows.length

  // Build row groups for divider rendering
  const groups = []
  let lastStatus = null
  for (const row of rows) {
    if (row.breach_status !== lastStatus) {
      groups.push({ type: 'header', status: row.breach_status })
      lastStatus = row.breach_status
    }
    groups.push({ type: 'row', row })
  }

  return (
    <div className={slaStyles.wrapper}>
      {/* Stats cards */}
      <div className={slaStyles.statsRow}>
        <div className={slaStyles.statCard} style={{ borderColor: BREACH_COLORS.breached.border, backgroundColor: BREACH_COLORS.breached.bg }}>
          <DismissCircle24Regular style={{ color: BREACH_COLORS.breached.border }} />
          <span className={slaStyles.statNum} style={{ color: BREACH_COLORS.breached.text }}>{breachedCount}</span>
          <Text size={200} style={{ color: BREACH_COLORS.breached.text, fontWeight: tokens.fontWeightSemibold }}>Breached</Text>
        </div>
        <div className={slaStyles.statCard} style={{ borderColor: BREACH_COLORS.at_risk.border, backgroundColor: BREACH_COLORS.at_risk.bg }}>
          <Warning24Regular style={{ color: BREACH_COLORS.at_risk.border }} />
          <span className={slaStyles.statNum} style={{ color: BREACH_COLORS.at_risk.text }}>{atRiskCount}</span>
          <Text size={200} style={{ color: BREACH_COLORS.at_risk.text, fontWeight: tokens.fontWeightSemibold }}>At Risk</Text>
        </div>
        <div className={slaStyles.statCard}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Total monitored</Text>
          <span className={slaStyles.statNum}>{totalCount}</span>
          <Text size={100} className={slaStyles.refTime}>ref: {formatDate(report?.reference_timestamp)}</Text>
        </div>
      </div>

      {/* Action bar */}
      <div className={slaStyles.actionBar}>
        <Button appearance="subtle" icon={<SelectAllOn24Regular />} onClick={toggleAll} size="small">
          {allSelected ? 'Deselect All' : 'Select All'}
        </Button>
        <Tooltip content="Send a reminder to the assigned group" relationship="description">
          <ToolbarButton
            icon={<Mail24Regular />}
            disabled={selectedCount === 0}
            onClick={() => alert(`Send Reminder for ${selectedCount} ticket(s):\n${[...selected].join(', ')}`)}
          >
            Send Reminder
          </ToolbarButton>
        </Tooltip>
        <Tooltip content="Escalate selected tickets" relationship="description">
          <ToolbarButton
            icon={<ArrowUp24Regular />}
            disabled={selectedCount === 0}
            onClick={() => alert(`Escalate ${selectedCount} ticket(s):\n${[...selected].join(', ')}`)}
          >
            Escalate
          </ToolbarButton>
        </Tooltip>
        {selectedCount > 0 && (
          <Text size={200} className={slaStyles.selectionInfo}>
            {selectedCount} of {rows.length} selected
          </Text>
        )}
      </div>

      {/* Table */}
      <div className={slaStyles.tableWrap}>
        <table className={slaStyles.table}>
          <thead>
            <tr>
              <th className={slaStyles.th} style={{ width: 36 }}>
                <Checkbox
                  checked={allSelected ? true : selectedCount > 0 ? 'mixed' : false}
                  onChange={toggleAll}
                />
              </th>
              <th className={slaStyles.th} style={{ width: 110 }}>Status</th>
              {SLA_COLUMNS.map(({ key, label }) => (
                <th key={key} className={slaStyles.th}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((item, i) => {
              if (item.type === 'header') {
                const colors = BREACH_COLORS[item.status] || BREACH_COLORS.unknown
                const Icon = colors.icon
                return (
                  <tr key={`header-${item.status}-${i}`}>
                    <td colSpan={SLA_COLUMNS.length + 2}
                      className={slaStyles.groupHeader}
                      style={{ backgroundColor: colors.bg, color: colors.text, borderBottom: `2px solid ${colors.border}` }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {Icon && <Icon style={{ fontSize: 16 }} />}
                        {colors.label}
                      </span>
                    </td>
                  </tr>
                )
              }

              const { row } = item
              const colors = BREACH_COLORS[row.breach_status] || BREACH_COLORS.unknown
              const isChecked = selected.has(row.ticket_id)
              const priorityStyle = PRIORITY_COLORS[row.priority] || {}

              return (
                <tr
                  key={row.ticket_id}
                  onClick={() => toggleOne(row.ticket_id)}
                  onKeyDown={(e) => e.key === ' ' && toggleOne(row.ticket_id)}
                  style={{ borderLeft: `4px solid ${colors.border}`, cursor: 'pointer', backgroundColor: isChecked ? colors.bg : undefined }}
                >
                  <td className={slaStyles.td} onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={isChecked} onChange={() => toggleOne(row.ticket_id)} />
                  </td>
                  <td className={slaStyles.td}>
                    <Badge appearance="filled" style={{ backgroundColor: colors.border, color: '#fff' }}>
                      {colors.label}
                    </Badge>
                  </td>
                  {SLA_COLUMNS.map(({ key }) => (
                    <td key={key} className={slaStyles.td}>
                      {key === 'priority' ? (
                        <Badge appearance="tint" style={{ backgroundColor: priorityStyle.bg, color: priorityStyle.color, border: `1px solid ${priorityStyle.color}30` }}>
                          {row.priority}
                        </Badge>
                      ) : key === 'reported_date' ? (
                        formatDate(row.reported_date)
                      ) : key === 'age_progress' ? (
                        <AgeBar ageHours={row.age_hours} thresholdHours={row.sla_threshold_hours} />
                      ) : (
                        String(row[key] ?? '—')
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export const RESULT_VIEW_REGISTRY = {
  table: {
    title: 'Structured Table',
    description: 'Structured fields extracted from the run output.',
    render: (props) => <ResultTableView {...props} />,
  },
  markdown: {
    title: 'Narrative Summary',
    description: 'Human-readable summary from the run output.',
    render: (props) => <ResultMarkdownView {...props} />,
  },
  'sla-breach': {
    title: 'SLA Breach Overview',
    description: 'Unassigned tickets color-coded by SLA status. Select tickets to send reminders or escalate.',
    render: (props) => <SlaBreachResultView {...props} />,
  },
}
