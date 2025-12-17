/**
 * TicketList Component
 *
 * Generic master-detail view for support tickets
 * Shows 100 most recent tickets with full detail view including worklogs
 *
 * Following principles:
 * - Pure functions for data transformations (calculations)
 * - Side effects isolated in event handlers (actions)
 * - Master-detail layout with split view
 */

import {
  Badge,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Select,
  Spinner,
  Tab,
  TabList,
  TableCellLayout,
  Text,
  createTableColumn,
  makeStyles,
  tokens
} from '@fluentui/react-components'
import {
  ArrowClockwise20Regular,
  Building20Regular,
  Calendar20Regular,
  Clock20Regular,
  Document20Regular,
  DocumentBulletList20Regular,
  Info20Regular,
  Location20Regular,
  Person20Regular,
  Search20Regular,
  Tag20Regular
} from '@fluentui/react-icons'
import { useEffect, useState } from 'react'

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  header: {
    backgroundColor: tokens.colorNeutralBackground1,
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  title: {
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightSemibold,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  ticketCount: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.4fr',
    gap: tokens.spacingHorizontalL,
    height: 'calc(100vh - 180px)',
    padding: tokens.spacingVerticalL,
    overflow: 'hidden',
  },
  listPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    overflow: 'hidden',
  },
  filterBar: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
  },
  gridContainer: {
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: 'auto',
    flexGrow: 1,
    boxShadow: tokens.shadow4,
  },
  detailPanel: {
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: tokens.shadow4,
  },
  detailHeader: {
    padding: tokens.spacingVerticalL,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  detailTitle: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: tokens.spacingVerticalS,
  },
  detailMeta: {
    display: 'flex',
    gap: tokens.spacingHorizontalL,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  detailContent: {
    flexGrow: 1,
    overflow: 'auto',
    padding: tokens.spacingVerticalM,
  },
  section: {
    marginBottom: tokens.spacingVerticalL,
  },
  sectionTitle: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: tokens.spacingVerticalM,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: tokens.spacingVerticalM,
  },
  detailField: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
  detailLabel: {
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: tokens.fontSizeBase300,
  },
  descriptionBox: {
    backgroundColor: tokens.colorNeutralBackground3,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    whiteSpace: 'pre-wrap',
    lineHeight: '1.5',
  },
  worklogItem: {
    borderLeft: `3px solid ${tokens.colorBrandStroke1}`,
    paddingLeft: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
  },
  worklogHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalXS,
  },
  worklogMeta: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  emptyDetail: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: tokens.colorNeutralForeground3,
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  selectedRow: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '400px',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  statusBadge: {
    textTransform: 'capitalize',
  },
})

// ============================================================================
// CALCULATIONS - Pure functions
// ============================================================================

function formatDate(isoString) {
  if (!isoString) return '—'
  const date = new Date(isoString)
  return date.toLocaleDateString('de-CH', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  }) + ' ' + date.toLocaleTimeString('de-CH', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

function formatRelativeTime(isoString) {
  if (!isoString) return '—'
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(isoString)
}

function getPriorityAppearance(priority) {
  const map = {
    critical: 'important',
    high: 'important', 
    medium: 'informative',
    low: 'subtle',
  }
  return map[priority?.toLowerCase()] || 'subtle'
}

function getStatusAppearance(status) {
  const map = {
    new: 'informative',
    assigned: 'informative',
    in_progress: 'warning',
    pending: 'warning',
    resolved: 'success',
    closed: 'subtle',
    cancelled: 'subtle',
  }
  return map[status?.toLowerCase()] || 'outline'
}

function filterTickets(tickets, searchTerm, priorityFilter, statusFilter) {
  let filtered = tickets

  if (searchTerm) {
    const term = searchTerm.toLowerCase()
    filtered = filtered.filter(
      (ticket) =>
        ticket.id?.toLowerCase().includes(term) ||
        ticket.summary?.toLowerCase().includes(term) ||
        ticket.requester_name?.toLowerCase().includes(term) ||
        ticket.service?.toLowerCase().includes(term)
    )
  }

  if (priorityFilter && priorityFilter !== 'all') {
    filtered = filtered.filter((t) => t.priority?.toLowerCase() === priorityFilter.toLowerCase())
  }

  if (statusFilter && statusFilter !== 'all') {
    filtered = filtered.filter((t) => t.status?.toLowerCase() === statusFilter.toLowerCase())
  }

  return filtered
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function TicketList() {
  const styles = useStyles()

  // State
  const [tickets, setTickets] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [ticketDetail, setTicketDetail] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('details')

  // Calculations
  const filteredTickets = filterTickets(tickets, searchTerm, priorityFilter, statusFilter)

  // Columns for DataGrid
  const columns = [
    createTableColumn({
      columnId: 'summary',
      compare: (a, b) => (a.summary || '').localeCompare(b.summary || ''),
      renderHeaderCell: () => 'Summary',
      renderCell: (item) => (
        <TableCellLayout truncate title={item.summary}>
          <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200 }}>
            {item.summary}
          </Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'status',
      compare: (a, b) => (a.status || '').localeCompare(b.status || ''),
      renderHeaderCell: () => 'Status',
      renderCell: (item) => (
        <TableCellLayout>
          <Badge 
            appearance={getStatusAppearance(item.status)} 
            className={styles.statusBadge}
          >
            {item.status?.replace('_', ' ')}
          </Badge>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'priority',
      compare: (a, b) => (a.priority || '').localeCompare(b.priority || ''),
      renderHeaderCell: () => 'Priority',
      renderCell: (item) => (
        <TableCellLayout>
          <Badge appearance={getPriorityAppearance(item.priority)}>
            {item.priority}
          </Badge>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'created',
      compare: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      renderHeaderCell: () => 'Created',
      renderCell: (item) => (
        <TableCellLayout>
          <Text style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
            {formatRelativeTime(item.created_at)}
          </Text>
        </TableCellLayout>
      ),
    }),
  ]

  // ============================================================================
  // ACTIONS - Event handlers & effects
  // ============================================================================

  // Load tickets on mount
  useEffect(() => {
    loadTickets()
  }, [])

  async function loadTickets() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/tickets?page_size=100')
      if (!response.ok) throw new Error('Failed to load tickets')
      const data = await response.json()
      setTickets(data.tickets || [])
    } catch (err) {
      setError(err.message || 'Error loading tickets')
    } finally {
      setLoading(false)
    }
  }

  async function loadTicketDetail(ticketId) {
    setDetailLoading(true)
    try {
      const response = await fetch(`/api/tickets/${ticketId}`)
      if (!response.ok) throw new Error('Failed to load ticket details')
      const data = await response.json()
      setTicketDetail(data)
    } catch (err) {
      console.error('Error loading ticket detail:', err)
      setTicketDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleRowClick = (ticket) => {
    setSelectedTicket(ticket)
    setActiveTab('details')
    loadTicketDetail(ticket.id)
  }

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  function renderDetailField(label, value, fullWidth = false) {
    return (
      <div className={styles.detailField} style={fullWidth ? { gridColumn: '1 / -1' } : undefined}>
        <Text className={styles.detailLabel}>{label}</Text>
        <Text className={styles.detailValue}>{value || '—'}</Text>
      </div>
    )
  }

  function renderWorklog(log) {
    return (
      <div key={log.id} className={styles.worklogItem}>
        <div className={styles.worklogHeader}>
          <Badge appearance="outline">{log.log_type}</Badge>
          <div className={styles.worklogMeta}>
            <span><Person20Regular /> {log.author}</span>
            <span><Clock20Regular /> {formatDate(log.created_at)}</span>
            {log.time_spent_minutes > 0 && (
              <span>{log.time_spent_minutes} min</span>
            )}
          </div>
        </div>
        <Text weight="semibold" style={{ display: 'block', marginBottom: tokens.spacingVerticalXS }}>
          {log.summary}
        </Text>
        {log.details && (
          <Text style={{ color: tokens.colorNeutralForeground2 }}>{log.details}</Text>
        )}
      </div>
    )
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spinner size="large" />
        <Text>Loading tickets...</Text>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.loadingContainer}>
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      </div>
    )
  }

  const detail = ticketDetail?.ticket

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Text className={styles.title}>
            <DocumentBulletList20Regular />
            Support Tickets
          </Text>
          <span className={styles.ticketCount}>{tickets.length} tickets</span>
        </div>
        <Badge appearance="outline" icon={<ArrowClockwise20Regular />}>
          Last updated: {formatRelativeTime(new Date().toISOString())}
        </Badge>
      </div>

      {/* MAIN LAYOUT */}
      <div className={styles.layout}>
        {/* LEFT PANEL - List */}
        <div className={styles.listPanel}>
          <div className={styles.filterBar}>
            <Field style={{ flexGrow: 1 }}>
              <Input
                placeholder="Search tickets..."
                value={searchTerm}
                onChange={(e, data) => setSearchTerm(data.value)}
                contentBefore={<Search20Regular />}
                data-testid="ticket-search"
              />
            </Field>
            <Field style={{ minWidth: '120px' }}>
              <Select
                value={statusFilter}
                onChange={(e, data) => setStatusFilter(data.value)}
                data-testid="filter-status"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </Select>
            </Field>
            <Field style={{ minWidth: '120px' }}>
              <Select
                value={priorityFilter}
                onChange={(e, data) => setPriorityFilter(data.value)}
                data-testid="filter-priority"
              >
                <option value="all">All Priority</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </Select>
            </Field>
          </div>

          <div className={styles.gridContainer}>
            <DataGrid
              items={filteredTickets}
              columns={columns}
              sortable
              getRowId={(item) => item.id}
            >
              <DataGridHeader>
                <DataGridRow>
                  {({ renderHeaderCell }) => (
                    <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
                  )}
                </DataGridRow>
              </DataGridHeader>
              <DataGridBody>
                {({ item, rowId }) => (
                  <DataGridRow
                    key={rowId}
                    onClick={() => handleRowClick(item)}
                    className={selectedTicket?.id === item.id ? styles.selectedRow : ''}
                    style={{ cursor: 'pointer' }}
                    data-testid={`ticket-row-${item.id}`}
                  >
                    {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                  </DataGridRow>
                )}
              </DataGridBody>
            </DataGrid>
          </div>
        </div>

        {/* RIGHT PANEL - Detail */}
        <div className={styles.detailPanel}>
          {detailLoading ? (
            <div className={styles.emptyDetail}>
              <Spinner size="medium" />
              <Text>Loading ticket details...</Text>
            </div>
          ) : detail ? (
            <>
              {/* Detail Header */}
              <div className={styles.detailHeader}>
                <Text className={styles.detailTitle}>{detail.summary}</Text>
                <div className={styles.detailMeta}>
                  <Badge appearance={getStatusAppearance(detail.status)} className={styles.statusBadge}>
                    {detail.status?.replace('_', ' ')}
                  </Badge>
                  <Badge appearance={getPriorityAppearance(detail.priority)}>
                    {detail.priority}
                  </Badge>
                  <span className={styles.metaItem}>
                    <Calendar20Regular /> {formatDate(detail.created_at)}
                  </span>
                  <span className={styles.metaItem}>
                    <Person20Regular /> {detail.requester_name}
                  </span>
                </div>
              </div>

              {/* Tabs */}
              <TabList 
                selectedValue={activeTab} 
                onTabSelect={(_, d) => setActiveTab(d.value)}
                style={{ padding: `0 ${tokens.spacingHorizontalM}`, borderBottom: `1px solid ${tokens.colorNeutralStroke1}` }}
              >
                <Tab value="details" icon={<Info20Regular />}>Details</Tab>
                <Tab value="worklogs" icon={<Document20Regular />}>
                  Worklogs ({ticketDetail?.work_logs?.length || 0})
                </Tab>
              </TabList>

              {/* Content */}
              <div className={styles.detailContent}>
                {activeTab === 'details' && (
                  <>
                    {/* Description */}
                    <div className={styles.section}>
                      <Text className={styles.sectionTitle}>
                        <Document20Regular /> Description
                      </Text>
                      <div className={styles.descriptionBox}>
                        {detail.description || 'No description provided.'}
                      </div>
                    </div>

                    {/* Requester Info */}
                    <div className={styles.section}>
                      <Text className={styles.sectionTitle}>
                        <Person20Regular /> Requester Information
                      </Text>
                      <div className={styles.fieldGrid}>
                        {renderDetailField('Name', detail.requester_name)}
                        {renderDetailField('Email', detail.requester_email)}
                        {renderDetailField('Phone', detail.requester_phone)}
                        {renderDetailField('Department', detail.requester_department)}
                        {renderDetailField('Company', detail.requester_company)}
                      </div>
                    </div>

                    {/* Location & Assignment */}
                    <div className={styles.section}>
                      <Text className={styles.sectionTitle}>
                        <Location20Regular /> Location & Assignment
                      </Text>
                      <div className={styles.fieldGrid}>
                        {renderDetailField('City', detail.city)}
                        {renderDetailField('Site', detail.site)}
                        {renderDetailField('Desk Location', detail.desk_location)}
                        {renderDetailField('Assignee', detail.assignee)}
                        {renderDetailField('Assigned Group', detail.assigned_group)}
                        {renderDetailField('Support Org', detail.support_organization)}
                      </div>
                    </div>

                    {/* Technical Details */}
                    <div className={styles.section}>
                      <Text className={styles.sectionTitle}>
                        <Tag20Regular /> Technical Details
                      </Text>
                      <div className={styles.fieldGrid}>
                        {renderDetailField('Service', detail.service)}
                        {renderDetailField('Product', detail.product_name)}
                        {renderDetailField('Manufacturer', detail.manufacturer)}
                        {renderDetailField('Model', detail.model_version)}
                        {renderDetailField('CI Name', detail.ci_name)}
                        {renderDetailField('Incident Type', detail.incident_type)}
                        {renderDetailField('Impact', detail.impact)}
                        {renderDetailField('Urgency', detail.urgency)}
                      </div>
                    </div>

                    {/* Categories */}
                    {(detail.operational_category_tier1 || detail.product_category_tier1) && (
                      <div className={styles.section}>
                        <Text className={styles.sectionTitle}>
                          <Building20Regular /> Categories
                        </Text>
                        <div className={styles.fieldGrid}>
                          {renderDetailField('Operational Tier 1', detail.operational_category_tier1)}
                          {renderDetailField('Operational Tier 2', detail.operational_category_tier2)}
                          {renderDetailField('Operational Tier 3', detail.operational_category_tier3)}
                          {renderDetailField('Product Tier 1', detail.product_category_tier1)}
                          {renderDetailField('Product Tier 2', detail.product_category_tier2)}
                          {renderDetailField('Product Tier 3', detail.product_category_tier3)}
                        </div>
                      </div>
                    )}

                    {/* Resolution */}
                    {detail.resolution && (
                      <div className={styles.section}>
                        <Text className={styles.sectionTitle}>Resolution</Text>
                        <div className={styles.descriptionBox}>{detail.resolution}</div>
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'worklogs' && (
                  <div className={styles.section}>
                    {ticketDetail?.work_logs?.length > 0 ? (
                      ticketDetail.work_logs.map(renderWorklog)
                    ) : (
                      <div className={styles.emptyDetail}>
                        <Text>No work logs available for this ticket.</Text>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className={styles.emptyDetail}>
              <DocumentBulletList20Regular style={{ fontSize: '48px', opacity: 0.5 }} />
              <Text size={400}>Select a ticket to view details</Text>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
