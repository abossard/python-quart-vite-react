/**
 * TicketsWithoutAnAssignee Component
 *
 * Master-detail view for tickets without an assignee
 * Displays unassigned tickets in a list with detail panel
 *
 * Following principles:
 * - Pure functions for data transformations (calculations)
 * - Side effects isolated in event handlers (actions)
 * - Master-detail layout with split view
 */

import {
  Badge,
  Button,
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
  TableCellLayout,
  Text,
  createTableColumn,
  makeStyles,
  tokens
} from '@fluentui/react-components'
import {
  AlertUrgent20Regular,
  Checkmark24Regular,
  PlayCircle24Regular,
  Search20Regular,
  Warning24Regular,
} from '@fluentui/react-icons'
import { useState } from 'react'
import { getQATickets } from '../../services/api'

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
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.2fr',
    gap: tokens.spacingHorizontalL,
    height: 'calc(100vh - 280px)',
    padding: tokens.spacingVerticalL,
  },
  listPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  filterBar: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
  },
  gridContainer: {
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: 'auto',
    flexGrow: 1,
  },
  detailPanel: {
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
  },
  detailContent: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  detailField: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  detailLabel: {
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  detailValue: {
    fontSize: tokens.fontSizeBase300,
  },
  footer: {
    display: 'grid',
    gridTemplateColumns: '1fr auto auto',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalL,
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  footerAction: {
    gridColumn: '3',
  },
  emptyDetail: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: tokens.colorNeutralForeground3,
  },
  selectedRow: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
  },
})

// ============================================================================
// CALCULATIONS - Pure functions
// ============================================================================

function formatDate(isoString) {
  const date = new Date(isoString)
  return date.toLocaleDateString('de-DE') + ' ' + date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function getPriorityBadge(priority) {
  const appearances = {
    Critical: 'important',
    High: 'important',
    Medium: 'informative',
    Low: 'subtle',
  }
  return appearances[priority] || 'subtle'
}

function filterTickets(tickets, searchTerm, priorityFilter) {
  let filtered = tickets

  if (searchTerm) {
    const term = searchTerm.toLowerCase()
    filtered = filtered.filter(
      (ticket) =>
        (ticket.incident_id || ticket.id).toLowerCase().includes(term) ||
        ticket.title.toLowerCase().includes(term) ||
        ticket.description.toLowerCase().includes(term)
    )
  }

  if (priorityFilter && priorityFilter !== 'all') {
    filtered = filtered.filter((ticket) => ticket.priority === priorityFilter)
  }

  return filtered
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function TicketsWithoutAnAssignee() {
  const styles = useStyles()

  // State
  const [tickets, setTickets] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [reminderMessage, setReminderMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasStarted, setHasStarted] = useState(false)
  const [ticketDecisions, setTicketDecisions] = useState({})

  // Calculations
  const filteredTickets = filterTickets(tickets, searchTerm, priorityFilter)

  // Columns for DataGrid
  const columns = [
    createTableColumn({
      columnId: 'incident_id',
      compare: (a, b) => (a.incident_id || a.id).localeCompare(b.incident_id || b.id),
      renderHeaderCell: () => 'Incident ID',
      renderCell: (item) => (
        <TableCellLayout>
          <Text weight="semibold" style={{ fontFamily: 'monospace' }}>
            {item.incident_id || item.id}
          </Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'title',
      compare: (a, b) => a.title.localeCompare(b.title),
      renderHeaderCell: () => 'Titel',
      renderCell: (item) => (
        <TableCellLayout truncate title={item.title}>
          {item.title}
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'priority',
      compare: (a, b) => a.priority.localeCompare(b.priority),
      renderHeaderCell: () => 'Priorität',
      renderCell: (item) => (
        <TableCellLayout>
          <Badge appearance={getPriorityBadge(item.priority)}>{item.priority}</Badge>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'status',
      compare: (a, b) => a.status.localeCompare(b.status),
      renderHeaderCell: () => 'Status',
      renderCell: (item) => (
        <TableCellLayout>
          <Badge appearance="outline">{item.status}</Badge>
        </TableCellLayout>
      ),
    }),
  ]

  // ============================================================================
  // ACTIONS - Event handlers
  // ============================================================================

  const handleRowClick = (ticket) => {
    setSelectedTicket(ticket)
    setReminderMessage(null)
  }

  const handleReminder = () => {
    if (selectedTicket) {
      setReminderMessage(`Erinnerung für Ticket ${selectedTicket.incident_id || selectedTicket.id} wurde gesendet.`)
      // TODO: Backend integration - send reminder API call
    }
  }

  const handleStartAnalysis = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getQATickets()
      setTickets(response.tickets)
      setHasStarted(true)
    } catch (err) {
      setError(err.message || 'Fehler beim Laden der Tickets')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsGood = () => {
    if (selectedTicket) {
      setTicketDecisions(prev => ({ ...prev, [selectedTicket.id]: 'GOOD' }))
      setReminderMessage(`Ticket ${selectedTicket.incident_id || selectedTicket.id} als GOOD markiert.`)
      // TODO: Backend integration - update ticket status
    }
  }

  const handleMarkAsEscalate = () => {
    if (selectedTicket) {
      setTicketDecisions(prev => ({ ...prev, [selectedTicket.id]: 'ESCALATE' }))
      setReminderMessage(`Ticket ${selectedTicket.incident_id || selectedTicket.id} zur Eskalation markiert.`)
      // TODO: Backend integration - escalate ticket
    }
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text className={styles.title}>Tickets Without Assignee</Text>
          <Button
            appearance="primary"
            icon={<PlayCircle24Regular />}
            onClick={handleStartAnalysis}
            disabled={loading}
            data-testid="start-unassigned-button"
          >
            {loading ? 'Lädt...' : 'Load Unassigned Tickets'}
          </Button>
        </div>
        {error && (
          <MessageBar intent="error" style={{ marginTop: tokens.spacingVerticalM }}>
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <Spinner size="large" label="Loading unassigned tickets..." />
        </div>
      ) : !hasStarted ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
          <Text size={500} weight="semibold">Ready to Load Unassigned Tickets</Text>
          <Text size={400}>Click "Load Unassigned Tickets" to fetch tickets without an assignee</Text>
        </div>
      ) : (
        <div className={styles.layout}>
          {/* LEFT PANEL - List */}
          <div className={styles.listPanel}>
            <div className={styles.filterBar}>
              <Field style={{ flexGrow: 1 }}>
                <Input
                  placeholder="Suche nach ID, Titel oder Beschreibung..."
                  value={searchTerm}
                  onChange={(e, data) => setSearchTerm(data.value)}
                  contentBefore={<Search20Regular />}
                  data-testid="unassigned-ticket-search"
                />
              </Field>
              <Field style={{ minWidth: '150px' }}>
                <Select
                  value={priorityFilter}
                  onChange={(e, data) => setPriorityFilter(data.value)}
                  data-testid="unassigned-filter-priority"
                >
                  <option value="all">Alle Prioritäten</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
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
                      data-testid={`unassigned-ticket-row-${item.id}`}
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
            {selectedTicket ? (
              <div className={styles.detailContent}>
                <div>
                  <Text size={600} weight="semibold">
                    {selectedTicket.title}
                  </Text>
                </div>

                <div className={styles.detailField}>
                  <Text className={styles.detailLabel}>Incident ID</Text>
                  <Text className={styles.detailValue} style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {selectedTicket.incident_id || selectedTicket.id}
                  </Text>
                </div>

                <div className={styles.detailField}>
                  <Text className={styles.detailLabel}>Status</Text>
                  <Badge appearance="outline">{selectedTicket.status}</Badge>
                </div>

                <div className={styles.detailField}>
                  <Text className={styles.detailLabel}>Priorität</Text>
                  <Badge appearance={getPriorityBadge(selectedTicket.priority)}>
                    {selectedTicket.priority}
                  </Badge>
                </div>

                <div className={styles.detailField}>
                  <Text className={styles.detailLabel}>Reporter</Text>
                  <Text className={styles.detailValue}>{selectedTicket.reporter}</Text>
                </div>

                <div className={styles.detailField}>
                  <Text className={styles.detailLabel}>Zugewiesen an</Text>
                  <Text className={styles.detailValue}>
                    {selectedTicket.assignee || 'Nicht zugewiesen'}
                  </Text>
                </div>

                <div className={styles.detailField}>
                  <Text className={styles.detailLabel}>Erstellt am</Text>
                  <Text className={styles.detailValue}>{formatDate(selectedTicket.createdAt)}</Text>
                </div>

                <div className={styles.detailField}>
                  <Text className={styles.detailLabel}>Aktualisiert am</Text>
                  <Text className={styles.detailValue}>{formatDate(selectedTicket.updatedAt)}</Text>
                </div>

                <div className={styles.detailField}>
                  <Text className={styles.detailLabel}>Beschreibung</Text>
                  <Text className={styles.detailValue}>{selectedTicket.description}</Text>
                </div>

                {selectedTicket.escalationNeeded && (
                  <MessageBar intent="warning">
                    <MessageBarBody>
                      <AlertUrgent20Regular /> Eskalation erforderlich
                    </MessageBarBody>
                  </MessageBar>
                )}

                {ticketDecisions[selectedTicket.id] && (
                  <MessageBar intent={ticketDecisions[selectedTicket.id] === 'GOOD' ? 'success' : 'error'}>
                    <MessageBarBody>
                      {ticketDecisions[selectedTicket.id] === 'GOOD' ? (
                        <><Checkmark24Regular /> Als GOOD markiert</>
                      ) : (
                        <><Warning24Regular /> Zur Eskalation markiert</>
                      )}
                    </MessageBarBody>
                  </MessageBar>
                )}
              </div>
            ) : (
              <div className={styles.emptyDetail}>
                <Text size={400}>Wählen Sie ein Ticket aus der Liste aus</Text>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className={styles.footer}>
        <div style={{ gridColumn: '1 / 3' }}>
          {reminderMessage && (
            <MessageBar intent="success">
              <MessageBarBody>{reminderMessage}</MessageBarBody>
            </MessageBar>
          )}
        </div>
        <Button
          appearance="primary"
          icon={<Checkmark24Regular />}
          onClick={handleMarkAsGood}
          disabled={!selectedTicket}
          style={{ backgroundColor: tokens.colorPaletteGreenBackground3, color: 'white' }}
          data-testid="unassigned-mark-good-button"
        >
          GOOD
        </Button>
        <Button
          appearance="primary"
          icon={<Warning24Regular />}
          onClick={handleMarkAsEscalate}
          disabled={!selectedTicket}
          style={{ backgroundColor: tokens.colorPaletteRedBackground3, color: 'white' }}
          className={styles.footerAction}
          data-testid="unassigned-mark-escalate-button"
        >
          ESCALATE
        </Button>
      </div>
    </div>
  )
}
