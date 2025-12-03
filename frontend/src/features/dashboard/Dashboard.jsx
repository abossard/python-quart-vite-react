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
import { Clock24Regular, CalendarLtr24Regular, DataBarVertical24Regular } from '@fluentui/react-icons'
import { connectToTimeStream, getCurrentDate, getTasks } from '../../services/api'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'

// ============================================================================
// CALCULATIONS
// ============================================================================

/**
 * Aggregiert Tasks nach Priorität für das Balkendiagramm.
 * Pure function - keine Side-Effects
 * Zählt nur nicht-erledigte Tasks (completed: false)
 * Farben entsprechen den Badge-Hintergrundfarben in der TaskList
 * @param {Array} tasks - Array of task objects
 * @returns {Array} Array of {priority, count, color} objects
 */
function getTasksByPriority(tasks) {
  // Hintergrundfarben entsprechend FluentUI Badge colors: danger, warning, important, success
  const priorityColors = {
    critical: tokens.colorPaletteRedBackground3,    // danger (rot)
    high: tokens.colorPaletteDarkOrangeBackground3, // warning (orange)
    medium: tokens.colorPaletteBlueBackground3,      // important (blau)
    low: tokens.colorPaletteGreenBackground3,        // success (grün)
  }

  const counts = { critical: 0, high: 0, medium: 0, low: 0 }

  // Nur nicht-erledigte Tasks zählen
  tasks.forEach((task) => {
    if (!task.completed && counts.hasOwnProperty(task.priority)) {
      counts[task.priority]++
    }
  })

  return [
    { priority: 'Critical', count: counts.critical, color: priorityColors.critical },
    { priority: 'High', count: counts.high, color: priorityColors.high },
    { priority: 'Medium', count: counts.medium, color: priorityColors.medium },
    { priority: 'Low', count: counts.low, color: priorityColors.low },
  ]
}

// ============================================================================
// STYLES
// ============================================================================

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
  spinnerContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '250px',
  },
  chartContainer: {
    marginTop: tokens.spacingVerticalM,
    height: '250px',
  },
})

// ============================================================================
// COMPONENT
// ============================================================================

export default function Dashboard() {
  const styles = useStyles()
  const [liveTime, setLiveTime] = useState(null)
  const [serverDate, setServerDate] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(true)

  // Fetch initial server date
  useEffect(() => {
    getCurrentDate()
      .then(setServerDate)
      .catch((err) => setError(err.message))
  }, [])

  // Fetch tasks for priority chart
  useEffect(() => {
    setLoadingTasks(true)
    getTasks()
      .then((data) => {
        setTasks(data)
        setLoadingTasks(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoadingTasks(false)
      })
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

  // Calculate priority distribution
  const priorityData = getTasksByPriority(tasks)

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

      <Card className={styles.card}>
        <CardHeader
          header={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DataBarVertical24Regular />
              <Text weight="semibold">Tasks by Priority</Text>
            </div>
          }
          description={<Text size={200}>Distribution of tasks by priority level</Text>}
        />
        <div className={styles.content}>
          {loadingTasks ? (
            <div className={styles.spinnerContainer}>
              <Spinner label="Loading tasks..." />
            </div>
          ) : (
            <div className={styles.chartContainer} data-testid="priority-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={priorityData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="priority" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="Tasks" radius={[8, 8, 0, 0]}>
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
