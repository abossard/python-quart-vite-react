import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  Text,
  Badge,
  Spinner,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  Dismiss24Regular,
  Eye24Regular,
} from '@fluentui/react-icons'
import { getSupportTickets } from '../../../services/api'

const useStyles = makeStyles({
  dialogSurface: {
    maxWidth: '900px',
    width: '90vw',
    maxHeight: '80vh',
  },
  ticketList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    maxHeight: '60vh',
    overflowY: 'auto',
    padding: tokens.spacingVerticalS,
  },
  ticketItem: {
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  ticketContent: {
    flex: 1,
    minWidth: 0,
  },
  ticketHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: tokens.spacingVerticalXS,
    gap: tokens.spacingHorizontalM,
  },
  ticketNumber: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    fontFamily: 'monospace',
  },
  ticketTitle: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    marginTop: tokens.spacingVerticalXXS,
    marginBottom: tokens.spacingVerticalXS,
  },
  ticketMeta: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  badgeContainer: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacingVerticalXXL,
  },
  emptyState: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground3,
  },
  count: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    marginBottom: tokens.spacingVerticalS,
  },
})

const priorityColors = {
  critical: 'danger',
  high: 'warning',
  medium: 'informative',
  low: 'success',
}

const statusColors = {
  open: 'danger',
  in_progress: 'warning',
  waiting_on_customer: 'informative',
  resolved: 'success',
  closed: 'subtle',
}

export function FilteredTicketsModal({ isOpen, onClose, filter, title, onViewDetails }) {
  const styles = useStyles()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen && filter) {
      loadTickets()
    }
  }, [isOpen, filter])

  async function loadTickets() {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch all tickets and filter on frontend
      // In a real app, you'd pass filter params to the API
      const allTickets = await getSupportTickets({ limit: 1000 })
      
      let filtered = allTickets
      
      if (filter.status) {
        filtered = filtered.filter(t => t.status === filter.status)
      }
      
      if (filter.priority) {
        filtered = filtered.filter(t => t.priority === filter.priority)
      }
      
      if (filter.isOpen) {
        filtered = filtered.filter(t => 
          t.status === 'open' || 
          t.status === 'in_progress' || 
          t.status === 'waiting_on_customer'
        )
      }
      
      if (filter.resolvedToday) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        filtered = filtered.filter(t => {
          if (!t.resolved_at) return false
          const resolvedDate = new Date(t.resolved_at)
          resolvedDate.setHours(0, 0, 0, 0)
          return resolvedDate.getTime() === today.getTime() && 
                 (t.status === 'resolved' || t.status === 'closed')
        })
      }
      
      // Sort by priority and created date
      filtered.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
        const aPriority = priorityOrder[a.priority] || 999
        const bPriority = priorityOrder[b.priority] || 999
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority
        }
        
        return new Date(b.created_at) - new Date(a.created_at)
      })
      
      setTickets(filtered)
    } catch (err) {
      setError(err.message || 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const handleViewTicket = (ticket) => {
    onClose()
    if (onViewDetails) {
      onViewDetails(ticket)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface className={styles.dialogSurface}>
        <DialogBody>
          <DialogTitle
            action={
              <Button
                appearance="subtle"
                aria-label="close"
                icon={<Dismiss24Regular />}
                onClick={onClose}
              />
            }
          >
            {title || 'Filtered Tickets'}
          </DialogTitle>

          <DialogContent>
            {loading ? (
              <div className={styles.loadingContainer}>
                <Spinner label="Loading tickets..." />
              </div>
            ) : error ? (
              <div className={styles.emptyState}>
                <Text style={{ color: tokens.colorPaletteRedForeground1 }}>
                  Error: {error}
                </Text>
              </div>
            ) : tickets.length === 0 ? (
              <div className={styles.emptyState}>
                <Text>No tickets found matching this filter</Text>
              </div>
            ) : (
              <>
                <Text className={styles.count}>
                  Showing {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
                </Text>
                <div className={styles.ticketList}>
                  {tickets.map((ticket) => (
                    <div key={ticket.id} className={styles.ticketItem}>
                      <div className={styles.ticketContent}>
                        <div className={styles.ticketHeader}>
                          <div>
                            <Text className={styles.ticketNumber}>{ticket.ticket_number}</Text>
                            <div className={styles.ticketTitle}>{ticket.title}</div>
                          </div>
                          <div className={styles.badgeContainer}>
                            <Badge size="small" color={priorityColors[ticket.priority]}>
                              {ticket.priority.toUpperCase()}
                            </Badge>
                            <Badge appearance="filled" color={statusColors[ticket.status]}>
                              {ticket.status.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                        <div className={styles.ticketMeta}>
                          <Text size={200}>
                            {ticket.category.replace('_', ' ').toUpperCase()}
                          </Text>
                          <Text size={200}>•</Text>
                          <Text size={200}>{formatDate(ticket.created_at)}</Text>
                          {ticket.assigned_to && (
                            <>
                              <Text size={200}>•</Text>
                              <Text size={200}>{ticket.assigned_to}</Text>
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        appearance="subtle"
                        size="small"
                        icon={<Eye24Regular />}
                        onClick={() => handleViewTicket(ticket)}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </DialogContent>

          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              Close
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
