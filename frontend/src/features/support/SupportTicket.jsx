import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Divider,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { Info24Regular, TicketDiagonalRegular, Warning24Regular } from '@fluentui/react-icons'
import { getSupportTicket } from '../../services/api'

const useStyles = makeStyles({
  container: {
    maxWidth: '720px',
    margin: '0 auto',
    padding: tokens.spacingVerticalXL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  statusRegion: {
    minHeight: '24px',
    color: tokens.colorNeutralForeground2,
  },
  errorCard: {
    borderLeft: `4px solid ${tokens.colorPaletteRedBorder1}`,
  },
  ticketCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  ticketMeta: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: tokens.spacingVerticalM,
  },
  description: {
    whiteSpace: 'pre-line',
  },
})

function formatDate(value) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  return date.toLocaleString()
}

export default function SupportTicket() {
  const styles = useStyles()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleLoadSupportTicket() {
    setLoading(true)
    setError(null)
    try {
      const data = await getSupportTicket()
      setTicket(data)
    } catch (err) {
      setError(err.message || 'Unable to load support ticket')
      setTicket(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.actions}>
        <Button
          appearance="primary"
          icon={<TicketDiagonalRegular />}
          onClick={handleLoadSupportTicket}
          disabled={loading}
          data-testid="load-support-ticket"
        >
          {loading ? 'Loading…' : 'Load Support Ticket'}
        </Button>
        {loading && <Spinner size="extra-tiny" label="Fetching ticket" />}
      </div>

      <div className={styles.statusRegion} role="status" aria-live="polite">
        {ticket && !loading && <Text size={200}>Latest ticket loaded.</Text>}
        {!ticket && !loading && <Text size={200}>No support ticket loaded yet.</Text>}
      </div>

      {error && (
        <Card appearance="subtle" className={styles.errorCard}>
          <CardHeader
            header={<Text weight="semibold">Unable to fetch support ticket</Text>}
            description={<Text size={200}>{error}</Text>}
            action={<Warning24Regular />}
          />
        </Card>
      )}

      {ticket && (
        <Card className={styles.ticketCard} data-testid="support-ticket-card">
          <CardHeader
            header={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info24Regular />
                <Text weight="semibold" data-testid="ticket-subject">
                  {ticket.subject}
                </Text>
              </div>
            }
            description={<Text size={200}>Ticket ID: {ticket.ticket_id}</Text>}
            action={
              <Badge appearance="filled" color="brand" data-testid="ticket-priority">
                {ticket.priority}
              </Badge>
            }
          />

          <Divider />

          <div className={styles.ticketMeta}>
            <div>
              <Text size={200} weight="semibold">
                Customer
              </Text>
              <Text>{ticket.customer.name}</Text>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                Account: {ticket.customer.account}
              </Text>
            </div>
            <div>
              <Text size={200} weight="semibold">
                Status
              </Text>
              <Badge appearance="outline" color="informative">
                {ticket.status}
              </Badge>
            </div>
            <div>
              <Text size={200} weight="semibold">
                Service
              </Text>
              <Text>{ticket.service}</Text>
            </div>
            <div>
              <Text size={200} weight="semibold">
                Last Updated
              </Text>
              <Text>{formatDate(ticket.last_updated)}</Text>
            </div>
          </div>

          <Divider />

          <div>
            <Text size={200} weight="semibold">
              Description
            </Text>
            <Text className={styles.description}>{ticket.description}</Text>
          </div>
        </Card>
      )}
    </div>
  )
}
