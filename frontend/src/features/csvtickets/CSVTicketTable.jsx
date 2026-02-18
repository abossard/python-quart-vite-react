/**
 * CSV Ticket Table Component
 *
 * Displays tickets from CSV data source in a clean HTML table.
 * 
 * Following Grokking Simplicity:
 * - Calculations: formatters, status helpers (pure)
 * - Actions: API calls
 * - Data: React state
 */

import {
    Badge,
    Button,
    Caption1,
    Card,
    CardHeader,
    Dropdown,
    makeStyles,
    Option,
    Spinner,
    Subtitle1,
    Text,
    tokens,
} from '@fluentui/react-components'
import {
    ArrowDown24Regular,
    ArrowSync24Regular,
    ArrowUp24Regular,
    Filter24Regular,
} from '@fluentui/react-icons'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCSVTicketFields, getCSVTickets, getCSVTicketStats } from '../../services/api'

// ============================================================================
// STYLES
// ============================================================================

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalL,
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
  },
  statsRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalL,
    flexWrap: 'wrap',
  },
  statCard: {
    minWidth: '120px',
  },
  filters: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: tokens.spacingVerticalM,
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
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    userSelect: 'none',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground3Hover,
    },
  },
  thContent: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  td: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    maxWidth: '300px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tr: {
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  trAlternate: {
    backgroundColor: tokens.colorNeutralBackground2,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground2Hover,
    },
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: tokens.spacingVerticalM,
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  paginationButtons: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacingVerticalXXL,
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
    padding: tokens.spacingVerticalL,
    textAlign: 'center',
  },
  noData: {
    padding: tokens.spacingVerticalXXL,
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
})

// ============================================================================
// CALCULATIONS - Pure functions
// ============================================================================

const STATUS_COLORS = {
  new: 'informative',
  assigned: 'brand',
  in_progress: 'warning',
  pending: 'warning',
  resolved: 'success',
  closed: 'success',
  cancelled: 'subtle',
}

const PRIORITY_COLORS = {
  critical: 'danger',
  high: 'warning',
  medium: 'informative',
  low: 'subtle',
}

function formatCellValue(value, fieldName) {
  if (value === null || value === undefined) {
    return '—'
  }
  
  if (fieldName === 'created_at' || fieldName === 'updated_at') {
    try {
      const date = new Date(value)
      return date.toLocaleString('de-CH', { 
        dateStyle: 'short', 
        timeStyle: 'short' 
      })
    } catch {
      return value
    }
  }
  
  return String(value)
}

function getStatusBadge(status) {
  const color = STATUS_COLORS[status] || 'subtle'
  return <Badge appearance="filled" color={color}>{status?.replace(/_/g, ' ') || '—'}</Badge>
}

function getPriorityBadge(priority) {
  const color = PRIORITY_COLORS[priority] || 'subtle'
  return <Badge appearance="tint" color={color}>{priority || '—'}</Badge>
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function CSVTicketTable() {
  const styles = useStyles()
  
  // State
  const [tickets, setTickets] = useState([])
  const [fields, setFields] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Filters and sorting
  const [statusFilter, setStatusFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  
  // Pagination
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const pageSize = 25
  
  // Selected columns
  const [selectedFields, setSelectedFields] = useState([
    'incident_id', 'summary', 'status', 'priority', 'assignee', 'assigned_group', 
    'requester_name', 'city', 'created_at'
  ])

  // Load field metadata
  useEffect(() => {
    async function loadFields() {
      try {
        const data = await getCSVTicketFields()
        setFields(data.fields || [])
      } catch (err) {
        console.error('Failed to load fields:', err)
      }
    }
    loadFields()
  }, [])

  // Load stats
  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getCSVTicketStats()
        setStats(data)
      } catch (err) {
        console.error('Failed to load stats:', err)
      }
    }
    loadStats()
  }, [])

  // Load tickets
  const loadTickets = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const options = {
        fields: selectedFields,
        sort: sortField,
        sortDir: sortDir,
        limit: pageSize,
        offset: offset,
      }
      
      if (statusFilter) {
        options.status = statusFilter
      }
      
      if (assigneeFilter === 'unassigned') {
        options.hasAssignee = false
      } else if (assigneeFilter === 'assigned') {
        options.hasAssignee = true
      }
      
      const data = await getCSVTickets(options)
      setTickets(data.tickets || [])
      setTotal(data.total || 0)
    } catch (err) {
      setError(err.message || 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }, [selectedFields, sortField, sortDir, offset, statusFilter, assigneeFilter])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  // Column headers based on selected fields
  const columns = useMemo(() => {
    return selectedFields.map(fieldName => {
      const fieldMeta = fields.find(f => f.name === fieldName)
      return {
        name: fieldName,
        label: fieldMeta?.label || fieldName,
      }
    })
  }, [selectedFields, fields])

  // Handle sort
  const handleSort = (fieldName) => {
    if (sortField === fieldName) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(fieldName)
      setSortDir('asc')
    }
    setOffset(0)
  }

  // Render cell content
  const renderCell = (ticket, fieldName) => {
    const value = ticket[fieldName]
    
    if (fieldName === 'incident_id') {
      return value ? (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, letterSpacing: '0.02em' }}>{value}</span>
      ) : '—'
    }

    if (fieldName === 'status') {
      return getStatusBadge(value)
    }
    
    if (fieldName === 'priority') {
      return getPriorityBadge(value)
    }
    
    return formatCellValue(value, fieldName)
  }

  // Pagination
  const currentPage = Math.floor(offset / pageSize) + 1
  const totalPages = Math.ceil(total / pageSize)
  
  const goToPage = (page) => {
    setOffset((page - 1) * pageSize)
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <Subtitle1>CSV Ticket Data</Subtitle1>
          <Caption1>Loaded from local CSV file</Caption1>
        </div>
        <Button 
          icon={<ArrowSync24Regular />} 
          onClick={loadTickets}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className={styles.statsRow}>
          <Card className={styles.statCard}>
            <CardHeader
              header={<Text weight="semibold">{stats.total}</Text>}
              description="Total Tickets"
            />
          </Card>
          <Card className={styles.statCard}>
            <CardHeader
              header={<Text weight="semibold">{stats.unassigned}</Text>}
              description="Unassigned"
            />
          </Card>
          {Object.entries(stats.by_status || {}).slice(0, 4).map(([status, count]) => (
            <Card key={status} className={styles.statCard}>
              <CardHeader
                header={<Text weight="semibold">{count}</Text>}
                description={status.replace('_', ' ')}
              />
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        <Filter24Regular />
        <Dropdown
          placeholder="Status"
          value={statusFilter || 'All Status'}
          onOptionSelect={(_, data) => {
            setStatusFilter(data.optionValue === 'all' ? '' : data.optionValue)
            setOffset(0)
          }}
        >
          <Option value="all">All Status</Option>
          <Option value="new">New</Option>
          <Option value="assigned">Assigned</Option>
          <Option value="in_progress">In Progress</Option>
          <Option value="pending">Pending</Option>
          <Option value="resolved">Resolved</Option>
        </Dropdown>
        
        <Dropdown
          placeholder="Assignee"
          value={assigneeFilter || 'All Assignees'}
          onOptionSelect={(_, data) => {
            setAssigneeFilter(data.optionValue === 'all' ? '' : data.optionValue)
            setOffset(0)
          }}
        >
          <Option value="all">All Assignees</Option>
          <Option value="assigned">Has Assignee</Option>
          <Option value="unassigned">Unassigned</Option>
        </Dropdown>
        
        <Text size={200} style={{ marginLeft: 'auto' }}>
          Showing {tickets.length} of {total} tickets
        </Text>
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>
            <Spinner size="large" label="Loading tickets..." />
          </div>
        ) : error ? (
          <div className={styles.error}>
            <Text>{error}</Text>
          </div>
        ) : tickets.length === 0 ? (
          <div className={styles.noData}>
            <Text>No tickets found</Text>
          </div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  {columns.map(col => (
                    <th 
                      key={col.name} 
                      className={styles.th}
                      onClick={() => handleSort(col.name)}
                    >
                      <span className={styles.thContent}>
                        {col.label}
                        {sortField === col.name && (
                          sortDir === 'asc' 
                            ? <ArrowUp24Regular style={{ width: 16, height: 16 }} />
                            : <ArrowDown24Regular style={{ width: 16, height: 16 }} />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket, idx) => (
                  <tr 
                    key={ticket.id || idx} 
                    className={idx % 2 === 0 ? styles.tr : styles.trAlternate}
                  >
                    {columns.map(col => (
                      <td key={col.name} className={styles.td}>
                        {renderCell(ticket, col.name)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className={styles.pagination}>
              <Text size={200}>
                Page {currentPage} of {totalPages}
              </Text>
              <div className={styles.paginationButtons}>
                <Button 
                  size="small"
                  disabled={currentPage <= 1}
                  onClick={() => goToPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <Button 
                  size="small"
                  disabled={currentPage >= totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
