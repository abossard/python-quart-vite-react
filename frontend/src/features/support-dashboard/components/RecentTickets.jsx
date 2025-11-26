/**
 * RecentTickets Component
 *
 * Scrollable list of recent support tickets with status badges
 */

import {
  Card,
  CardHeader,
  Text,
  Badge,
  Button,
  makeStyles,
  tokens,
  Spinner,
} from '@fluentui/react-components'
import { History24Regular, Eye24Regular } from '@fluentui/react-icons'

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalL,
    height: '600px',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  ticketList: {
    flex: 1,
    marginTop: tokens.spacingVerticalM,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
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
  },
  ticketNumber: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
    fontFamily: 'monospace',
  },
  ticketTitle: {
    fontSize: '14px',
    fontWeight: 500,
    marginTop: tokens.spacingVerticalXXS,
    marginBottom: tokens.spacingVerticalXS,
  },
  ticketMeta: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
  },
})

const STATUS_COLORS = {
  open: 'danger',
  in_progress: 'warning',
  waiting_on_customer: 'informative',
  resolved: 'success',
  closed: 'subtle',
}

const PRIORITY_COLORS = {
  critical: 'danger',
  high: 'warning',
  medium: 'informative',
  low: 'success',
}

export default function RecentTickets({ tickets, loading, onViewDetails }) {
  const styles = useStyles()

  if (loading) {
    return (
      <Card className={styles.card}>
        <Spinner label="Loading recent tickets..." />
      </Card>
    )
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

  return (
    <Card className={styles.card} data-testid="recent-tickets">
      <CardHeader
        header={
          <div className={styles.header}>
            <History24Regular style={{ fontSize: '20px' }} />
            <Text weight="semibold" size={400}>Recent Tickets</Text>
          </div>
        }
        description={<Text size={200}>Latest support requests</Text>}
      />
      <div className={styles.ticketList}>
        {tickets && tickets.length > 0 ? (
          tickets.slice(0, 20).map((ticket) => (
            <div key={ticket.id} className={styles.ticketItem}>
              <div className={styles.ticketContent}>
                <div className={styles.ticketHeader}>
                  <div>
                    <Text className={styles.ticketNumber}>{ticket.ticket_number}</Text>
                    <div className={styles.ticketTitle}>{ticket.title}</div>
                  </div>
                  <Badge appearance="filled" color={STATUS_COLORS[ticket.status]}>
                    {ticket.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                <div className={styles.ticketMeta}>
                  <Badge size="small" color={PRIORITY_COLORS[ticket.priority]}>
                    {ticket.priority.toUpperCase()}
                  </Badge>
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
                onClick={() => onViewDetails && onViewDetails(ticket)}
              >
                View
              </Button>
            </div>
          ))
        ) : (
          <Text>No recent tickets</Text>
        )}
      </div>
    </Card>
  )
}
