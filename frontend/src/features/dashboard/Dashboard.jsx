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
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalL,
  },
  card: {
    padding: tokens.spacingVerticalL,
  },
  timeDisplay: {
    fontSize: '48px',
    fontWeight: 'bold',
    color: tokens.colorBrandForeground1,
    fontVariantNumeric: 'tabular-nums',
  },
  dateDisplay: {
    fontSize: '24px',
    color: tokens.colorNeutralForeground2,
  },
  label: {
    fontSize: '14px',
    color: tokens.colorNeutralForeground3,
    marginBottom: tokens.spacingVerticalS,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
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

      <Card className={styles.card}>
        <CardHeader
          header={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarLtr24Regular />
              <Text weight="semibold">Server Date</Text>
            </div>
          }
          description={<Text size={200}>Current date from API</Text>}
        />
        <div className={styles.content}>
          {serverDate ? (
            <>
              <div>
                <div className={styles.label}>Date</div>
                <div className={styles.dateDisplay} data-testid="server-date">
                  {serverDate.date}
                </div>
              </div>
              <div>
                <div className={styles.label}>Time</div>
                <div className={styles.dateDisplay} data-testid="server-time">
                  {serverDate.time}
                </div>
              </div>
              <div>
                <div className={styles.label}>ISO 8601</div>
                <Text size={200} font="monospace">
                  {serverDate.datetime}
                </Text>
              </div>
            </>
          ) : error ? (
            <Text>Error: {error}</Text>
          ) : (
            <Spinner label="Loading..." />
          )}
        </div>
      </Card>
    </div>
  )
}
