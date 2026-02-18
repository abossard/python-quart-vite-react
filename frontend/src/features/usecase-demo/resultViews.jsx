import {
  Badge,
  Button,
  Checkbox,
  Text,
  ToolbarButton,
  Tooltip,
  makeStyles,
  tokens
} from '@fluentui/react-components'
import {
  ArrowUp24Regular,
  Mail24Regular,
  SelectAllOn24Regular,
} from '@fluentui/react-icons'
import { useCallback, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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

const BREACH_ORDER = { breached: 0, 'at risk': 1, ok: 2, unknown: 3 }
const BREACH_COLORS = {
  breached: { bg: '#fde7e9', border: '#d13438', label: 'Breached' },
  'at risk': { bg: '#fff4ce', border: '#f7630c', label: 'At Risk' },
  ok:       { bg: '#dff6dd', border: '#107c10', label: 'OK' },
  unknown:  { bg: '#f5f5f5', border: '#8a8886', label: '—' },
}

const SLA_HOURS = { 1: 4, 2: 24, 3: 72, 4: 120 }

function parseDate(val) {
  if (!val) return null
  // Try DD.MM.YYYY HH:MM:SS (CSV export format)
  const m = String(val).match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6])
  const iso = new Date(val)
  return isNaN(iso) ? null : iso
}

function computeBreach(ticket, refMs) {
  const priorityNum = parseInt(String(ticket.priority || '4')) || 4
  const threshold = SLA_HOURS[priorityNum] || 120
  const reported = parseDate(ticket.reported_date || ticket.created_at)
  if (!reported) return { breach_status: 'unknown', age_hours: null, threshold }
  const age = (refMs - reported.getTime()) / 3_600_000
  const breach_status = age > threshold ? 'breached' : age > threshold * 0.75 ? 'at risk' : 'ok'
  return { breach_status, age_hours: Math.round(age * 10) / 10, threshold }
}

const useSlaStyles = makeStyles({
  wrapper: {
    display: 'grid',
    gap: tokens.spacingVerticalM,
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
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground3,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    verticalAlign: 'top',
  },
})

const SLA_COLUMNS = [
  { key: 'breach_status', label: 'SLA Status' },
  { key: 'summary',       label: 'Summary' },
  { key: 'priority',      label: 'Priority' },
  { key: 'urgency',       label: 'Urgency' },
  { key: 'assigned_group',label: 'Assigned Group' },
  { key: 'reported_date', label: 'Reported' },
  { key: 'age_hours',     label: 'Age (h)' },
  { key: 'sla_hours',     label: 'SLA (h)' },
]

function SlaBreachResultView({ matchingTickets, isLoadingTickets }) {
  const slaStyles = useSlaStyles()
  const [selected, setSelected] = useState(new Set())

  // derive reference timestamp: max date across all tickets
  const refMs = useMemo(() => {
    let max = 0
    for (const t of matchingTickets || []) {
      for (const field of ['reported_date', 'last_modified_date', 'created_at']) {
        const d = parseDate(t[field])
        if (d && d.getTime() > max) max = d.getTime()
      }
    }
    return max || Date.now()
  }, [matchingTickets])

  const enriched = useMemo(() => {
    return (matchingTickets || []).map((t) => {
      const { breach_status, age_hours, threshold } = computeBreach(t, refMs)
      return { ...t, breach_status, age_hours, sla_hours: threshold }
    })
  }, [matchingTickets, refMs])

  const sortedRows = useMemo(() => {
    return [...enriched].sort((a, b) => {
      const oa = BREACH_ORDER[a.breach_status] ?? 3
      const ob = BREACH_ORDER[b.breach_status] ?? 3
      if (oa !== ob) return oa - ob
      return (b.age_hours ?? 0) - (a.age_hours ?? 0)
    })
  }, [enriched])

  const allIds = useMemo(() => sortedRows.map((r) => r.id), [sortedRows])
  const allSelected = sortedRows.length > 0 && selected.size === sortedRows.length

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

  if (isLoadingTickets) {
    return <Text>Loading tickets...</Text>
  }

  if (!sortedRows.length) {
    return <Text>No at-risk or breached tickets found.</Text>
  }

  const selectedCount = selected.size
  const breachedCount = sortedRows.filter((r) => r.breach_status === 'breached').length
  const atRiskCount = sortedRows.filter((r) => r.breach_status === 'at risk').length

  return (
    <div className={slaStyles.wrapper}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Badge appearance="filled" style={{ backgroundColor: BREACH_COLORS.breached.border, color: '#fff' }}>
          {breachedCount} Breached
        </Badge>
        <Badge appearance="filled" style={{ backgroundColor: BREACH_COLORS['at risk'].border, color: '#fff' }}>
          {atRiskCount} At Risk
        </Badge>
      </div>

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
            {selectedCount} of {sortedRows.length} selected
          </Text>
        )}
      </div>

      <div className={slaStyles.tableWrap}>
        <table className={slaStyles.table}>
          <thead>
            <tr>
              <th className={slaStyles.th}>
                <Checkbox
                  checked={allSelected ? true : selectedCount > 0 ? 'mixed' : false}
                  onChange={toggleAll}
                />
              </th>
              {SLA_COLUMNS.map(({ key, label }) => (
                <th key={key} className={slaStyles.th}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const colors = BREACH_COLORS[row.breach_status] || BREACH_COLORS.unknown
              const isChecked = selected.has(row.id)
              return (
                <tr
                  key={row.id}
                  style={{ backgroundColor: colors.bg, borderLeft: `4px solid ${colors.border}` }}
                >
                  <td className={slaStyles.td}>
                    <Checkbox checked={isChecked} onChange={() => toggleOne(row.id)} />
                  </td>
                  {SLA_COLUMNS.map(({ key }) => (
                    <td key={key} className={slaStyles.td}>
                      {key === 'breach_status' ? (
                        <Badge appearance="filled" style={{ backgroundColor: colors.border, color: '#fff' }}>
                          {colors.label}
                        </Badge>
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
    description: 'Individual tickets color-coded by computed SLA status (Red = Breached, Orange = At Risk, Green = OK). Select tickets, then Send Reminder or Escalate.',
    render: (props) => <SlaBreachResultView {...props} />,
  },
}
