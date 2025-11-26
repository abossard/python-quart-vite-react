/**
 * Ticket Overview Component
 *
 * Displays comprehensive ticket/task statistics and detailed lists
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
} from '@fluentui/react-components'
import { DocumentBulletList24Regular } from '@fluentui/react-icons'
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: tokens.spacingVerticalM,
  },
  statCard: {
    padding: tokens.spacingVerticalM,
    backgroundColor: 'var(--text-color)',
    border: '2px solid var(--bg-color)',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: 'var(--bg-color)',
  },
  statLabel: {
    fontSize: '14px',
    color: 'var(--bg-color)',
    marginTop: tokens.spacingVerticalXS,
  },
  priorityGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: tokens.spacingVerticalS,
    marginTop: tokens.spacingVerticalM,
  },
  priorityItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: tokens.spacingVerticalS,
    backgroundColor: 'var(--text-color)',
    border: '1px solid var(--bg-color)',
    color: 'var(--bg-color)',
  },
  section: {
    backgroundColor: 'var(--text-color)',
    padding: tokens.spacingVerticalL,
    border: '2px solid var(--bg-color)',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: 'var(--bg-color)',
    marginBottom: tokens.spacingVerticalM,
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
  },
  td: {
    padding: tokens.spacingVerticalS,
    borderBottom: '1px solid var(--text-color)',
    color: 'var(--text-color)',
  },
  ticketId: {
    fontFamily: 'monospace',
    fontSize: '12px',
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

// Calculation: Format time for display
const formatTime = (hours) => {
  if (!hours) return '0h'
  if (hours < 1) {
    return `${Math.round(hours * 60)}min`
  }
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export default function TicketOverview() {
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
        <Spinner label="Lade Ticket-Übersicht..." />
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

  return (
    <div className={styles.container}>
      <Card>
        <CardHeader
          header={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DocumentBulletList24Regular style={{ color: 'var(--text-color)' }} />
              <Text weight="semibold" size={600} style={{ color: 'var(--text-color)' }}>
                Ticket-Übersicht - Alle Zahlen
              </Text>
            </div>
          }
        />
      </Card>

      {/* Main Statistics */}
      <div className={styles.statsGrid}>
        <Card className={styles.statCard}>
          <div className={styles.statValue}>{overview.total}</div>
          <div className={styles.statLabel}>Gesamt Tickets</div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statValue}>{overview.completed}</div>
          <div className={styles.statLabel}>Erledigt</div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statValue}>{overview.in_progress}</div>
          <div className={styles.statLabel}>In Bearbeitung</div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statValue}>{overview.pending}</div>
          <div className={styles.statLabel}>Offen</div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statValue}>{overview.completion_rate}%</div>
          <div className={styles.statLabel}>Fortschritt</div>
        </Card>
      </div>

      {/* Priority Breakdown */}
      <Card className={styles.section}>
        <div className={styles.sectionTitle}>Nach Priorität</div>
        <div className={styles.priorityGrid}>
          {Object.entries(overview.by_priority).map(([priority, count]) => (
            <div key={priority} className={styles.priorityItem}>
              <Badge appearance={priorityAppearance[priority]}>
                {priorityLabels[priority]}
              </Badge>
              <Text weight="bold" style={{ color: 'var(--bg-color)' }}>{count}</Text>
            </div>
          ))}
        </div>
      </Card>

      {/* Pending Tasks */}
      {overview.tasks_by_status.pending.length > 0 && (
        <Card className={styles.section}>
          <div className={styles.sectionTitle}>
            Offene Tickets ({overview.tasks_by_status.pending.length})
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Ticket-Nr</th>
                <th className={styles.th}>Titel</th>
                <th className={styles.th}>Beschreibung</th>
                <th className={styles.th}>Priorität</th>
                <th className={styles.th}>Zeit verbucht</th>
                <th className={styles.th}>Erstellt am</th>
              </tr>
            </thead>
            <tbody>
              {overview.tasks_by_status.pending.map((task) => (
                <tr key={task.id}>
                  <td className={styles.td}>
                    <span className={styles.ticketId}>INC{task.id.replace(/\D/g, '').substring(0, 7).padStart(7, '0')}</span>
                  </td>
                  <td className={styles.td}>{task.title}</td>
                  <td className={styles.td}>{task.description || '-'}</td>
                  <td className={styles.td}>
                    <Badge appearance={priorityAppearance[task.priority]}>
                      {priorityLabels[task.priority]}
                    </Badge>
                  </td>
                  <td className={styles.td}>
                    <strong>{formatTime(task.time_spent || 0)}</strong>
                  </td>
                  <td className={styles.td}>
                    <div>{new Date(task.created_at).toLocaleDateString('de-DE')}</div>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>
                      {new Date(task.created_at).toLocaleTimeString('de-DE')}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* In Progress Tasks */}
      {overview.tasks_by_status.in_progress && overview.tasks_by_status.in_progress.length > 0 && (
        <Card className={styles.section}>
          <div className={styles.sectionTitle}>
            Tickets in Bearbeitung ({overview.tasks_by_status.in_progress.length})
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Ticket-Nr</th>
                <th className={styles.th}>Titel</th>
                <th className={styles.th}>Beschreibung</th>
                <th className={styles.th}>Priorität</th>
                <th className={styles.th}>Zeit verbucht</th>
                <th className={styles.th}>Erstellt am</th>
              </tr>
            </thead>
            <tbody>
              {overview.tasks_by_status.in_progress.map((task) => (
                <tr key={task.id}>
                  <td className={styles.td}>
                    <span className={styles.ticketId}>INC{task.id.replace(/\D/g, '').substring(0, 7).padStart(7, '0')}</span>
                  </td>
                  <td className={styles.td}>{task.title}</td>
                  <td className={styles.td}>{task.description || '-'}</td>
                  <td className={styles.td}>
                    <Badge appearance={priorityAppearance[task.priority]}>
                      {priorityLabels[task.priority]}
                    </Badge>
                  </td>
                  <td className={styles.td}>
                    <strong>{formatTime(task.time_spent || 0)}</strong>
                  </td>
                  <td className={styles.td}>
                    <div>{new Date(task.created_at).toLocaleDateString('de-DE')}</div>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>
                      {new Date(task.created_at).toLocaleTimeString('de-DE')}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Completed Tasks */}
      {overview.tasks_by_status.completed.length > 0 && (
        <Card className={styles.section}>
          <div className={styles.sectionTitle}>
            Erledigte Tickets ({overview.tasks_by_status.completed.length})
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Ticket-Nr</th>
                <th className={styles.th}>Titel</th>
                <th className={styles.th}>Beschreibung</th>
                <th className={styles.th}>Priorität</th>
                <th className={styles.th}>Zeit verbucht</th>
                <th className={styles.th}>Geschlossen am</th>
              </tr>
            </thead>
            <tbody>
              {overview.tasks_by_status.completed.map((task) => (
                <tr key={task.id}>
                  <td className={styles.td}>
                    <span className={styles.ticketId}>INC{task.id.replace(/\D/g, '').substring(0, 7).padStart(7, '0')}</span>
                  </td>
                  <td className={styles.td}>{task.title}</td>
                  <td className={styles.td}>{task.description || '-'}</td>
                  <td className={styles.td}>
                    <Badge appearance={priorityAppearance[task.priority]}>
                      {priorityLabels[task.priority]}
                    </Badge>
                  </td>
                  <td className={styles.td}>
                    <strong>{formatTime(task.time_spent || 0)}</strong>
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
    </div>
  )
}
