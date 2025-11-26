import { useState, useEffect } from 'react'
import {
  Card,
  CardHeader,
  Text,
  Spinner,
  makeStyles,
  tokens,
  Badge,
} from '@fluentui/react-components'
import {
  Person24Regular,
  CheckmarkCircle24Regular,
  Clock24Regular,
  Star24Regular,
} from '@fluentui/react-icons'
import { getTechnicianPerformance } from '../../../services/api'

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalL,
  },
  header: {
    marginBottom: tokens.spacingVerticalM,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  techCard: {
    padding: tokens.spacingVerticalL,
  },
  techHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalM,
  },
  techIcon: {
    fontSize: '32px',
    color: tokens.colorBrandForeground1,
  },
  techName: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingVerticalM,
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  metricLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  metricValue: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  fullWidth: {
    gridColumn: '1 / -1',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  },
  errorContainer: {
    padding: tokens.spacingVerticalXXL,
    textAlign: 'center',
    color: tokens.colorPaletteRedForeground1,
  },
})

export function TechnicianDashboard() {
  const styles = useStyles()
  const [performance, setPerformance] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadPerformance()
  }, [])

  async function loadPerformance() {
    try {
      setLoading(true)
      setError(null)
      const data = await getTechnicianPerformance()
      setPerformance(data)
    } catch (err) {
      setError(err.message || 'Failed to load technician performance')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spinner label="Loading technician performance..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <Text size={500} weight="semibold">
          Error: {error}
        </Text>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text size={600} weight="bold">
          Technician Performance
        </Text>
        <Text size={300}>
          Performance metrics and workload for all technicians
        </Text>
      </div>

      <div className={styles.grid}>
        {performance.map((tech) => (
          <Card key={tech.technician} className={styles.techCard}>
            <CardHeader
              header={
                <div className={styles.techHeader}>
                  <Person24Regular className={styles.techIcon} />
                  <div>
                    <Text className={styles.techName}>{tech.technician}</Text>
                    <div>
                      <Badge
                        appearance="tint"
                        color={tech.in_progress_tickets > 0 ? 'success' : 'subtle'}
                      >
                        {tech.in_progress_tickets > 0 ? 'Active' : 'Available'}
                      </Badge>
                    </div>
                  </div>
                </div>
              }
            />

            <div className={styles.metricsGrid}>
              <div className={styles.metric}>
                <div className={styles.metricLabel}>
                  <CheckmarkCircle24Regular />
                  <Text>Total Tickets</Text>
                </div>
                <Text className={styles.metricValue}>{tech.total_tickets}</Text>
              </div>

              <div className={styles.metric}>
                <div className={styles.metricLabel}>
                  <CheckmarkCircle24Regular />
                  <Text>Resolved</Text>
                </div>
                <Text className={styles.metricValue}>{tech.resolved_tickets}</Text>
              </div>

              <div className={styles.metric}>
                <div className={styles.metricLabel}>
                  <Clock24Regular />
                  <Text>In Progress</Text>
                </div>
                <Text className={styles.metricValue}>{tech.in_progress_tickets}</Text>
              </div>

              <div className={styles.metric}>
                <div className={styles.metricLabel}>
                  <Clock24Regular />
                  <Text>Time Spent</Text>
                </div>
                <Text className={styles.metricValue}>
                  {tech.total_time_spent_hours.toFixed(1)}h
                </Text>
              </div>

              <div className={`${styles.metric} ${styles.fullWidth}`}>
                <div className={styles.metricLabel}>
                  <Clock24Regular />
                  <Text>Avg Resolution Time</Text>
                </div>
                <Text className={styles.metricValue}>
                  {tech.avg_resolution_hours ? `${tech.avg_resolution_hours.toFixed(1)}h` : 'N/A'}
                </Text>
              </div>

              <div className={`${styles.metric} ${styles.fullWidth}`}>
                <div className={styles.metricLabel}>
                  <Star24Regular />
                  <Text>Satisfaction Score</Text>
                </div>
                <Text className={styles.metricValue}>
                  {tech.satisfaction_score ? `${tech.satisfaction_score.toFixed(1)}/5.0` : 'N/A'}
                </Text>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
