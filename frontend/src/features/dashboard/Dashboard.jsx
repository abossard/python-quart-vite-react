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
import { Clock24Regular, CalendarLtr24Regular, TaskListSquareLtr24Regular } from '@fluentui/react-icons'
import { connectToTimeStream, getCurrentDate, getTaskStats } from '../../services/api'

const useStyles = makeStyles({
  dashboard: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalL,
    backgroundColor: 'var(--bg-color)',
  },
  card: {
    padding: tokens.spacingVerticalL,
    backgroundColor: 'var(--text-color)',
    border: '2px solid var(--bg-color)',
  },
  timeDisplay: {
    fontSize: '48px',
    fontWeight: 'bold',
    color: 'var(--bg-color)',
    fontVariantNumeric: 'tabular-nums',
  },
  dateDisplay: {
    fontSize: '24px',
    color: 'var(--bg-color)',
  },
  label: {
    fontSize: '14px',
    color: 'var(--bg-color)',
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
  const [taskStats, setTaskStats] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)

  // Fetch initial server date
  useEffect(() => {
    getCurrentDate()
      .then(setServerDate)
      .catch((err) => setError(err.message))
  }, [])

  // Fetch task statistics
  useEffect(() => {
    getTaskStats()
      .then(setTaskStats)
      .catch((err) => console.error('Failed to load task stats:', err))
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
              <Clock24Regular style={{ color: 'var(--bg-color)' }} />
              <Text weight="semibold" style={{ color: 'var(--bg-color)' }}>Live Server Time</Text>
            </div>
          }
          description={
            isConnected ? (
              <Text size={200} style={{ color: 'var(--bg-color)' }}>Connected via Server-Sent Events</Text>
            ) : (
              <Text size={200} style={{ color: 'var(--bg-color)' }}>Connecting...</Text>
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
              <CalendarLtr24Regular style={{ color: 'var(--bg-color)' }} />
              <Text weight="semibold" style={{ color: 'var(--bg-color)' }}>Server Date</Text>
            </div>
          }
          description={<Text size={200} style={{ color: 'var(--bg-color)' }}>Current date from API</Text>}
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
                <Text size={200} font="monospace" style={{ color: 'var(--bg-color)' }}>
                  {serverDate.datetime}
                </Text>
              </div>
            </>
          ) : error ? (
            <Text style={{ color: 'var(--bg-color)' }}>Error: {error}</Text>
          ) : (
            <Spinner label="Loading..." />
          )}
        </div>
      </Card>

      <Card className={styles.card}>
        <CardHeader
          header={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TaskListSquareLtr24Regular style={{ color: 'var(--bg-color)' }} />
              <Text weight="semibold" style={{ color: 'var(--bg-color)' }}>Task Statistics</Text>
            </div>
          }
          description={<Text size={200} style={{ color: 'var(--bg-color)' }}>Overview of all tasks</Text>}
        />
        <div className={styles.content}>
          {taskStats ? (
            <>
              <div>
                <div className={styles.label}>Total Tasks</div>
                <div className={styles.timeDisplay} data-testid="stats-total">
                  {taskStats.total}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ flex: 1 }}>
                  <div className={styles.label}>Completed</div>
                  <div className={styles.dateDisplay} data-testid="stats-completed">
                    {taskStats.completed}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className={styles.label}>Pending</div>
                  <div className={styles.dateDisplay} data-testid="stats-pending">
                    {taskStats.pending}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <Spinner label="Loading statistics..." />
          )}
        </div>
      </Card>
    </div>
  )
}
