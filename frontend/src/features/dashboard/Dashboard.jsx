/**
 * Dashboard Component
 *
 * Displays real-time server information using Server-Sent Events
 * Demonstrates FluentUI Card and Text components
 */

import { useEffect, useState } from 'react'
import {
  Card,
  CardHeader,
  Text,
  makeStyles,
  tokens,
  Spinner,
} from '@fluentui/react-components'
import { Clock24Regular, CalendarLtr24Regular } from '@fluentui/react-icons'
import { connectToTimeStream, getCurrentDate } from '../../services/api'

const useStyles = makeStyles({
  dashboard: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalM,
  },
  card: {
    padding: tokens.spacingVerticalM,
  },
  timeDisplay: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: tokens.colorBrandForeground1,
    fontVariantNumeric: 'tabular-nums',
  },
  dateDisplay: {
    fontSize: '16px',
    color: tokens.colorNeutralForeground2,
  },
  label: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
    marginBottom: tokens.spacingVerticalXS,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
})

export default function Dashboard() {
  const styles = useStyles()
  const [liveTime, setLiveTime] = useState(null)
  const [serverDate, setServerDate] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)

  // Fetch initial server date
  useEffect(() => {
    getCurrentDate()
      .then(setServerDate)
      .catch((err) => setError(err.message))
  }, [])

  // Connect to live time stream
  useEffect(() => {
    const cleanup = connectToTimeStream(
      (data) => {
        setLiveTime(data)
        setIsConnected(true)
        setError(null)
      },
      (err) => {
        setError('Connection lost')
        setIsConnected(false)
      }
    )

    return cleanup
  }, [])

  return (
    <div className={styles.dashboard}>
      <Card className={styles.card}>
        <CardHeader
          header={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock24Regular />
              <Text weight="semibold">Live Server Time</Text>
            </div>
          }
          description={
            isConnected ? (
              <Text size={200}>Connected via Server-Sent Events</Text>
            ) : (
              <Text size={200}>Connecting...</Text>
            )
          }
        />
        <div className={styles.content}>
          {liveTime ? (
            <>
              <div className={styles.timeDisplay} data-testid="live-time">
                {liveTime.time}
              </div>
              <div className={styles.dateDisplay}>{liveTime.date}</div>
            </>
          ) : (
            <Spinner label="Connecting to server..." />
          )}
        </div>
      </Card>
    </div>
  )
}
