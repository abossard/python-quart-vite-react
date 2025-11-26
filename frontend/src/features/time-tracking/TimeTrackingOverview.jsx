/**
 * Time Tracking Overview Component
 *
 * Displays comprehensive time tracking statistics and closed tickets overview
 */

import { useEffect, useState } from 'react'
import {
  Card,
  CardHeader,
  Text,
  makeStyles,
  tokens,
  Spinner,
  Badge,
  Button,
} from '@fluentui/react-components'
import { Clock24Regular, CheckmarkCircle24Regular } from '@fluentui/react-icons'
import { getTaskOverview } from '../../services/api'

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
    backgroundColor: 'var(--bg-color)',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: tokens.spacingVerticalM,
  },
  statCard: {
    padding: tokens.spacingVerticalL,
    backgroundColor: 'var(--text-color)',
    border: '2px solid var(--bg-color)',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '42px',
    fontWeight: 'bold',
    color: 'var(--bg-color)',
    marginBottom: tokens.spacingVerticalS,
  },
  statLabel: {
    fontSize: '16px',
    color: 'var(--bg-color)',
    fontWeight: '500',
  },
  section: {
    backgroundColor: 'var(--text-color)',
    padding: tokens.spacingVerticalL,
    border: '2px solid var(--bg-color)',
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: 'var(--bg-color)',
    marginBottom: tokens.spacingVerticalM,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: 'var(--bg-color)',
  },
  th: {
    padding: tokens.spacingVerticalM,
    textAlign: 'left',
    borderBottom: '2px solid var(--text-color)',
    color: 'var(--text-color)',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  td: {
    padding: tokens.spacingVerticalS,
    borderBottom: '1px solid var(--text-color)',
    color: 'var(--text-color)',
  },
  ticketId: {
    fontFamily: 'monospace',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  timeHighlight: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: 'var(--text-color)',
  },
  progressBar: {
    marginTop: tokens.spacingVerticalM,
    height: '24px',
    backgroundColor: 'var(--bg-color)',
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    transition: 'width 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: '12px',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalL,
  },
})

const priorityLabels = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
  urgent: 'Dringend'
}

const priorityAppearance = {
  low: 'subtle',
  medium: 'informative',
  high: 'warning',
  urgent: 'danger'
}

// ============================================================================
// CALCULATIONS - Pure functions
// ============================================================================

const formatTime = (hours) => {
  if (!hours) return '0h'
  if (hours < 1) {
    return `${Math.round(hours * 60)}min`
  }
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

const calculateTotalTime = (tasks) => {
  return tasks.reduce((sum, task) => sum + (task.time_spent || 0), 0)
}

const calculateAverageTime = (tasks) => {
  if (tasks.length === 0) return 0
  return calculateTotalTime(tasks) / tasks.length
}

const getTasksWithTime = (tasks) => {
  return tasks.filter(task => task.time_spent > 0)
}

const sortTasksByTime = (tasks) => {
  return [...tasks].sort((a, b) => (b.time_spent || 0) - (a.time_spent || 0))
}

const sortTasksByClosedDate = (tasks) => {
  return [...tasks].sort((a, b) => {
    if (!a.closed_at) return 1
    if (!b.closed_at) return -1
    return new Date(b.closed_at) - new Date(a.closed_at)
  })
}

const calculateTimeDuration = (startDate, endDate) => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffMs = end - start
  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays = Math.floor(diffHours / 24)
  const remainingHours = Math.floor(diffHours % 24)
  
  if (diffDays > 0) {
    return `${diffDays}d ${remainingHours}h`
  }
  return `${remainingHours}h`
}

export default function TimeTrackingOverview() {
  const styles = useStyles()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadOverview()
  }, [])

  const loadOverview = async () => {
    try {
      setLoading(true)
      const data = await getTaskOverview()
      setOverview(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <Spinner label="Lade Zeiterfassungs-Übersicht..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <Text style={{ color: 'var(--text-color)' }}>Fehler: {error}</Text>
      </div>
    )
  }

  if (!overview) {
    return null
  }

  // Calculations
  const allTasks = [
    ...overview.tasks_by_status.completed,
    ...overview.tasks_by_status.in_progress,
    ...overview.tasks_by_status.pending
  ]
  
  const totalTimeSpent = calculateTotalTime(allTasks)
  const completedTotalTime = calculateTotalTime(overview.tasks_by_status.completed)
  const inProgressTotalTime = calculateTotalTime(overview.tasks_by_status.in_progress)
  const averageTimePerTask = calculateAverageTime(overview.tasks_by_status.completed)
  const tasksWithTime = getTasksWithTime(allTasks)
  const topTimeTasks = sortTasksByTime(tasksWithTime).slice(0, 10)
  const recentlyClosed = sortTasksByClosedDate(overview.tasks_by_status.completed).slice(0, 10)

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <Card>
          <CardHeader
            header={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock24Regular style={{ color: 'var(--text-color)' }} />
                <Text weight="semibold" size={600} style={{ color: 'var(--text-color)' }}>
                  Zeiterfassung & Geschlossene Tickets
                </Text>
              </div>
            }
          />
        </Card>
        <Button appearance="primary" onClick={loadOverview}>
          Aktualisieren
        </Button>
      </div>

      {/* Time Statistics */}
      <div className={styles.statsGrid}>
        <Card className={styles.statCard}>
          <div className={styles.statValue}>{formatTime(totalTimeSpent)}</div>
          <div className={styles.statLabel}>Gesamt verbucht</div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statValue}>{formatTime(completedTotalTime)}</div>
          <div className={styles.statLabel}>Erledigte Tickets</div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statValue}>{formatTime(inProgressTotalTime)}</div>
          <div className={styles.statLabel}>In Bearbeitung</div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statValue}>{formatTime(averageTimePerTask)}</div>
          <div className={styles.statLabel}>Ø pro Ticket</div>
        </Card>
      </div>

      {/* Completion Progress */}
      <Card className={styles.section}>
        <div className={styles.sectionTitle}>
          <CheckmarkCircle24Regular />
          Abschlussfortschritt
        </div>
        <div style={{ color: 'var(--bg-color)' }}>
          <Text size={400} style={{ color: 'var(--bg-color)' }}>
            {overview.completed} von {overview.total} Tickets geschlossen ({overview.completion_rate}%)
          </Text>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${overview.completion_rate}%` }}
            >
              {overview.completion_rate > 10 && (
                <span className={styles.progressText}>{overview.completion_rate}%</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Top 10 Time Consumers */}
      {topTimeTasks.length > 0 && (
        <Card className={styles.section}>
          <div className={styles.sectionTitle}>
            <Clock24Regular />
            Top 10 - Meiste Zeit verbucht
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Ticket-Nr</th>
                <th className={styles.th}>Titel</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Priorität</th>
                <th className={styles.th}>Zeit verbucht</th>
              </tr>
            </thead>
            <tbody>
              {topTimeTasks.map((task) => (
                <tr key={task.id}>
                  <td className={styles.td}>
                    <span className={styles.ticketId}>
                      INC{task.id.replace(/\D/g, '').substring(0, 7).padStart(7, '0')}
                    </span>
                  </td>
                  <td className={styles.td}>{task.title}</td>
                  <td className={styles.td}>
                    <Badge
                      appearance="filled"
                      color={task.completed ? 'success' : task.in_progress ? 'warning' : 'informative'}
                    >
                      {task.completed ? 'Erledigt' : task.in_progress ? 'In Bearbeitung' : 'Offen'}
                    </Badge>
                  </td>
                  <td className={styles.td}>
                    <Badge appearance={priorityAppearance[task.priority]}>
                      {priorityLabels[task.priority]}
                    </Badge>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.timeHighlight}>{formatTime(task.time_spent)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Recently Closed Tickets */}
      {recentlyClosed.length > 0 && (
        <Card className={styles.section}>
          <div className={styles.sectionTitle}>
            <CheckmarkCircle24Regular />
            Zuletzt geschlossene Tickets
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Ticket-Nr</th>
                <th className={styles.th}>Titel</th>
                <th className={styles.th}>Priorität</th>
                <th className={styles.th}>Zeit verbucht</th>
                <th className={styles.th}>Bearbeitungsdauer</th>
                <th className={styles.th}>Geschlossen am</th>
              </tr>
            </thead>
            <tbody>
              {recentlyClosed.map((task) => (
                <tr key={task.id}>
                  <td className={styles.td}>
                    <span className={styles.ticketId}>
                      INC{task.id.replace(/\D/g, '').substring(0, 7).padStart(7, '0')}
                    </span>
                  </td>
                  <td className={styles.td}>{task.title}</td>
                  <td className={styles.td}>
                    <Badge appearance={priorityAppearance[task.priority]}>
                      {priorityLabels[task.priority]}
                    </Badge>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.timeHighlight}>{formatTime(task.time_spent || 0)}</span>
                  </td>
                  <td className={styles.td}>
                    {task.closed_at && calculateTimeDuration(task.created_at, task.closed_at)}
                  </td>
                  <td className={styles.td}>
                    {task.closed_at ? (
                      <>
                        <div>{new Date(task.closed_at).toLocaleDateString('de-DE')}</div>
                        <div style={{ fontSize: '12px', opacity: 0.8 }}>
                          {new Date(task.closed_at).toLocaleTimeString('de-DE')}
                        </div>
                      </>
                    ) : (
                      <div>-</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Time Tracking by Priority */}
      <Card className={styles.section}>
        <div className={styles.sectionTitle}>
          <Clock24Regular />
          Zeiterfassung nach Priorität
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {Object.entries(overview.by_priority).map(([priority, count]) => {
            const tasksForPriority = allTasks.filter(t => t.priority === priority)
            const timeForPriority = calculateTotalTime(tasksForPriority)
            return (
              <div 
                key={priority} 
                style={{ 
                  padding: '16px', 
                  backgroundColor: 'var(--bg-color)',
                  border: '1px solid var(--text-color)',
                  borderRadius: '8px'
                }}
              >
                <Badge appearance={priorityAppearance[priority]} size="large">
                  {priorityLabels[priority]}
                </Badge>
                <div style={{ marginTop: '8px', color: 'var(--text-color)' }}>
                  <Text weight="bold" size={500}>{formatTime(timeForPriority)}</Text>
                  <br />
                  <Text size={200}>{count} Tickets</Text>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
