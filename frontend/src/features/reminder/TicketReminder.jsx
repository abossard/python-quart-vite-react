/**
 * TicketReminder Component
 *
 * Tabbed view for reminder management:
 * - Candidates tab: Tickets needing reminders (placeholder)
 * - Sent Reminders tab: Outbox of sent reminders with expandable content
 *
 * Following principles:
 * - Pure functions for data transformations (calculations)
 * - Side effects isolated in event handlers (actions)
 * - Deep module: self-contained reminder feature
 */

import {
    Badge,
    Button,
    Checkbox,
    DataGrid,
    DataGridBody,
    DataGridCell,
    DataGridHeader,
    DataGridHeaderCell,
    DataGridRow,
    MessageBar,
    MessageBarBody,
    Spinner,
    Tab,
    TabList,
    TableCellLayout,
    Text,
    createTableColumn,
    makeStyles,
    tokens,
} from '@fluentui/react-components'
import {
    ArrowSync24Regular,
    ChevronDown20Regular,
    ChevronRight20Regular,
    Mail24Regular,
    Send24Regular,
} from '@fluentui/react-icons'
import { useEffect, useState } from 'react'
import { fetchOutboxEntries, fetchReminderCandidates, sendReminders } from '../../services/api'
import { clearSelections, getSelectedTickets, isTicketSelected, toggleTicketSelection } from '../../services/reminderStorage'

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
  },
  header: {
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingVerticalL,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  title: {
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightSemibold,
  },
  tabContent: {
    padding: tokens.spacingVerticalL,
  },
  gridContainer: {
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: 'auto',
    marginTop: tokens.spacingVerticalM,
  },
  toolbar: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalM,
  },
  expandedContent: {
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
    whiteSpace: 'pre-wrap',
    fontFamily: 'monospace',
    fontSize: tokens.fontSizeBase200,
    maxHeight: '300px',
    overflow: 'auto',
  },
  clickableRow: {
    cursor: 'pointer',
  },
  expandIcon: {
    marginRight: tokens.spacingHorizontalS,
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '400px',
    gap: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground3,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground3,
  },
  remindedRow: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
  },
  selectionCount: {
    marginLeft: tokens.spacingHorizontalM,
    color: tokens.colorNeutralForeground2,
  },
})

// ============================================================================
// CALCULATIONS - Pure functions
// ============================================================================

function formatDate(isoString) {
  const date = new Date(isoString)
  return (
    date.toLocaleDateString('de-DE') +
    ' ' +
    date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  )
}

function truncateText(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

function getPriorityAppearance(priority) {
  const map = {
    Critical: 'important',
    High: 'important',
    Medium: 'informative',
    Low: 'subtle',
    Standard: 'subtle',
  }
  return map[priority] || 'subtle'
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function TicketReminder() {
  const styles = useStyles()

  // State - Outbox
  const [activeTab, setActiveTab] = useState('candidates')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  // State - Candidates
  const [candidates, setCandidates] = useState([])
  const [selections, setSelections] = useState([])
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [candidatesError, setCandidatesError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  // ============================================================================
  // ACTIONS - Event handlers
  // ============================================================================

  const loadOutboxEntries = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetchOutboxEntries()
      setEntries(response.entries || [])
    } catch (err) {
      setError(err.message || 'Failed to load outbox entries')
    } finally {
      setLoading(false)
    }
  }

  const handleRowClick = (entry) => {
    setExpandedId(expandedId === entry.id ? null : entry.id)
  }

  const handleRefresh = () => {
    loadOutboxEntries()
  }

  // Candidates actions
  const loadCandidates = async () => {
    setCandidatesLoading(true)
    setCandidatesError(null)
    setSuccessMessage(null)
    try {
      const response = await fetchReminderCandidates()
      setCandidates(response.candidates || [])
      setSelections(getSelectedTickets())
    } catch (err) {
      setCandidatesError(err.message || 'Failed to load candidates')
    } finally {
      setCandidatesLoading(false)
    }
  }

  const handleCheckboxChange = (ticketId) => {
    toggleTicketSelection(ticketId)
    setSelections(getSelectedTickets())
  }

  const handleSendReminders = async () => {
    if (selections.length === 0) return
    setCandidatesLoading(true)
    setCandidatesError(null)
    try {
      const result = await sendReminders(selections)
      clearSelections()
      setSelections([])
      setSuccessMessage(`Successfully sent ${result.sent} reminder(s)`)
      loadCandidates()
    } catch (err) {
      setCandidatesError(err.message || 'Failed to send reminders')
    } finally {
      setCandidatesLoading(false)
    }
  }

  // Load on tab change
  useEffect(() => {
    if (activeTab === 'outbox') {
      loadOutboxEntries()
    } else if (activeTab === 'candidates') {
      loadCandidates()
    }
  }, [activeTab])

  // Columns for outbox DataGrid
  const outboxColumns = [
    createTableColumn({
      columnId: 'expand',
      renderHeaderCell: () => '',
      renderCell: (item) => (
        <TableCellLayout>
          {expandedId === item.id ? (
            <ChevronDown20Regular className={styles.expandIcon} />
          ) : (
            <ChevronRight20Regular className={styles.expandIcon} />
          )}
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'ticket_id',
      compare: (a, b) => a.ticket_id.localeCompare(b.ticket_id),
      renderHeaderCell: () => 'Ticket ID',
      renderCell: (item) => (
        <TableCellLayout>
          <Text weight="semibold">{item.ticket_id}</Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'recipient',
      compare: (a, b) => a.recipient.localeCompare(b.recipient),
      renderHeaderCell: () => 'Recipient',
      renderCell: (item) => (
        <TableCellLayout>
          <Text>{item.recipient}</Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'sent_at',
      compare: (a, b) => new Date(a.sent_at) - new Date(b.sent_at),
      renderHeaderCell: () => 'Sent Date',
      renderCell: (item) => (
        <TableCellLayout>
          <Text>{formatDate(item.sent_at)}</Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'preview',
      renderHeaderCell: () => 'Preview',
      renderCell: (item) => (
        <TableCellLayout truncate title={item.markdown_content}>
          <Text>{truncateText(item.markdown_content, 60)}</Text>
        </TableCellLayout>
      ),
    }),
  ]

  // Columns for candidates DataGrid
  const candidatesColumns = [
    createTableColumn({
      columnId: 'select',
      renderHeaderCell: () => '',
      renderCell: (item) => (
        <TableCellLayout>
          <Checkbox
            checked={isTicketSelected(item.ticket_id)}
            onChange={() => handleCheckboxChange(item.ticket_id)}
            data-testid={`select-${item.ticket_id}`}
          />
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'ticket_id',
      compare: (a, b) => a.ticket_id.localeCompare(b.ticket_id),
      renderHeaderCell: () => 'Ticket ID',
      renderCell: (item) => (
        <TableCellLayout>
          <Text weight="semibold">{item.ticket_id}</Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'priority',
      compare: (a, b) => a.priority.localeCompare(b.priority),
      renderHeaderCell: () => 'Priority',
      renderCell: (item) => (
        <TableCellLayout>
          <Badge appearance={getPriorityAppearance(item.priority)}>{item.priority}</Badge>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'group_name',
      compare: (a, b) => (a.group_name || '').localeCompare(b.group_name || ''),
      renderHeaderCell: () => 'Group',
      renderCell: (item) => (
        <TableCellLayout>
          <Text>{item.group_name || '-'}</Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'created_at',
      compare: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      renderHeaderCell: () => 'Created',
      renderCell: (item) => (
        <TableCellLayout>
          <Text>{formatDate(item.created_at)}</Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'is_overdue',
      renderHeaderCell: () => 'SLA Status',
      renderCell: (item) => (
        <TableCellLayout>
          <Badge appearance={item.is_overdue ? 'important' : 'subtle'}>
            {item.is_overdue ? 'Overdue' : 'OK'}
          </Badge>
        </TableCellLayout>
      ),
    }),
  ]

  // ============================================================================
  // RENDER
  // ============================================================================

  const renderOutboxTab = () => (
    <div className={styles.tabContent}>
      <div className={styles.toolbar}>
        <Button
          appearance="secondary"
          icon={<ArrowSync24Regular />}
          onClick={handleRefresh}
          disabled={loading}
          data-testid="refresh-outbox-button"
        >
          Refresh
        </Button>
      </div>

      {error && (
        <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalM }}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: tokens.spacingVerticalXXL }}>
          <Spinner size="large" label="Loading sent reminders..." />
        </div>
      ) : entries.length === 0 ? (
        <div className={styles.emptyState}>
          <Mail24Regular style={{ fontSize: '48px' }} />
          <Text size={500}>No reminders sent yet</Text>
          <Text size={300}>Sent reminders will appear here</Text>
        </div>
      ) : (
        <div className={styles.gridContainer}>
          <DataGrid
            items={entries}
            columns={outboxColumns}
            sortable
            getRowId={(item) => item.id}
            data-testid="outbox-grid"
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
                <>
                  <DataGridRow
                    key={rowId}
                    onClick={() => handleRowClick(item)}
                    className={styles.clickableRow}
                    data-testid={`outbox-row-${item.id}`}
                  >
                    {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                  </DataGridRow>
                  {expandedId === item.id && (
                    <div className={styles.expandedContent} data-testid={`outbox-expanded-${item.id}`}>
                      {item.markdown_content}
                    </div>
                  )}
                </>
              )}
            </DataGridBody>
          </DataGrid>
        </div>
      )}
    </div>
  )

  const renderCandidatesTab = () => (
    <div className={styles.tabContent}>
      <div className={styles.toolbar}>
        <Button
          appearance="secondary"
          icon={<ArrowSync24Regular />}
          onClick={loadCandidates}
          disabled={candidatesLoading}
          data-testid="refresh-candidates-button"
        >
          Get Reminder Tickets
        </Button>
        <Button
          appearance="primary"
          icon={<Send24Regular />}
          onClick={handleSendReminders}
          disabled={candidatesLoading || selections.length === 0}
          data-testid="send-reminders-button"
        >
          Remind NOW
        </Button>
        {selections.length > 0 && (
          <Text className={styles.selectionCount}>
            {selections.length} ticket(s) selected
          </Text>
        )}
      </div>

      {successMessage && (
        <MessageBar intent="success" style={{ marginBottom: tokens.spacingVerticalM }}>
          <MessageBarBody>{successMessage}</MessageBarBody>
        </MessageBar>
      )}

      {candidatesError && (
        <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalM }}>
          <MessageBarBody>{candidatesError}</MessageBarBody>
        </MessageBar>
      )}

      {candidatesLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: tokens.spacingVerticalXXL }}>
          <Spinner size="large" label="Loading candidates..." />
        </div>
      ) : candidates.length === 0 ? (
        <div className={styles.emptyState}>
          <Mail24Regular style={{ fontSize: '48px' }} />
          <Text size={500}>No reminder candidates</Text>
          <Text size={300}>Click "Get Reminder Tickets" to load candidates</Text>
        </div>
      ) : (
        <div className={styles.gridContainer}>
          <DataGrid
            items={candidates}
            columns={candidatesColumns}
            sortable
            getRowId={(item) => item.ticket_id}
            data-testid="candidates-grid"
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
                  className={item.was_reminded_before ? styles.remindedRow : ''}
                  data-testid={`candidate-row-${item.ticket_id}`}
                >
                  {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                </DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>
        </div>
      )}
    </div>
  )

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text className={styles.title}>Ticket Reminders</Text>
      </div>

      <TabList
        selectedValue={activeTab}
        onTabSelect={(_, data) => setActiveTab(data.value)}
        style={{ padding: tokens.spacingVerticalM }}
      >
        <Tab value="candidates" data-testid="tab-candidates">
          Candidates
        </Tab>
        <Tab value="outbox" data-testid="tab-outbox">
          Sent Reminders
        </Tab>
      </TabList>

      {activeTab === 'candidates' && renderCandidatesTab()}
      {activeTab === 'outbox' && renderOutboxTab()}
    </div>
  )
}
