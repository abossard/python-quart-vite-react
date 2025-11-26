/**
 * SystemHealthMonitor Component
 *
 * Real-time system health indicators with live SSE updates
 * Displays queue depth, active connections, response time, and error rate
 */

import { useState, useEffect } from 'react'
import {
  Card,
  CardHeader,
  Text,
  makeStyles,
  tokens,
  Spinner,
  Badge,
} from '@fluentui/react-components'
import {
  Circle20Filled,
  ChevronUp20Regular,
  ChevronDown20Regular,
} from '@fluentui/react-icons'
import { connectToSupportStream } from '../../services/api'

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalL,
  },
  header: {
    marginBottom: tokens.spacingVerticalM,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: tokens.spacingVerticalM,
  },
  metric: {
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    transition: 'background-color 0.3s ease',
  },
  metricHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacingVerticalS,
  },
  metricLabel: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
  metricValue: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: tokens.spacingVerticalXS,
  },
  indicator: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  pulseGreen: {
    color: tokens.colorPaletteGreenForeground1,
    animation: 'pulse 2s ease-in-out infinite',
  },
  pulseYellow: {
    color: tokens.colorPaletteYellowForeground1,
    animation: 'pulse 2s ease-in-out infinite',
  },
  pulseRed: {
    color: tokens.colorPaletteRedForeground1,
    animation: 'pulse 2s ease-in-out infinite',
  },
  statusText: {
    fontSize: tokens.fontSizeBase200,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXXS,
  },
  statusGood: {
    color: tokens.colorPaletteGreenForeground1,
  },
  statusWarning: {
    color: tokens.colorPaletteYellowForeground1,
  },
  statusCritical: {
    color: tokens.colorPaletteRedForeground1,
  },
  timestamp: {
    marginTop: tokens.spacingVerticalM,
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  error: {
    padding: tokens.spacingVerticalL,
    textAlign: 'center',
    color: tokens.colorPaletteRedForeground1,
  },
})

// Add keyframe animation for pulse effect
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `
  document.head.appendChild(style)
}

// ============================================================================
// CALCULATIONS - Pure functions
// ============================================================================

function getQueueStatus(depth) {
  if (depth <= 10) return { level: 'good', label: 'Normal' }
  if (depth <= 20) return { level: 'warning', label: 'Elevated' }
  return { level: 'critical', label: 'High' }
}

function getResponseTimeStatus(ms) {
  if (ms <= 180) return { level: 'good', label: 'Fast' }
  if (ms <= 250) return { level: 'warning', label: 'Slow' }
  return { level: 'critical', label: 'Critical' }
}

function getErrorRateStatus(rate) {
  if (rate <= 0.25) return { level: 'good', label: 'Low' }
  if (rate <= 0.5) return { level: 'warning', label: 'Elevated' }
  return { level: 'critical', label: 'High' }
}

function formatTimestamp(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleTimeString()
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SystemHealthMonitor() {
  const styles = useStyles()

  const [healthData, setHealthData] = useState(null)
  const [error, setError] = useState(null)
  const [connecting, setConnecting] = useState(true)

  useEffect(() => {
    let cleanup = null

    const connectStream = () => {
      setConnecting(true)
      setError(null)

      cleanup = connectToSupportStream(
        (data) => {
          setHealthData(data)
          setConnecting(false)
          setError(null)
        },
        (err) => {
          console.error('SSE Error:', err)
          setError('Connection lost. Attempting to reconnect...')
          setConnecting(false)
          
          // Attempt to reconnect after 5 seconds
          setTimeout(connectStream, 5000)
        }
      )
    }

    connectStream()

    return () => {
      if (cleanup) cleanup()
    }
  }, [])

  if (connecting && !healthData) {
    return (
      <Card className={styles.card}>
        <div className={styles.loading}>
          <Spinner label="Connecting to live stream..." />
        </div>
      </Card>
    )
  }

  if (error && !healthData) {
    return (
      <Card className={styles.card}>
        <div className={styles.error}>
          <Text>{error}</Text>
        </div>
      </Card>
    )
  }

  if (!healthData) {
    return (
      <Card className={styles.card}>
        <div className={styles.loading}>
          <Text>Waiting for data...</Text>
        </div>
      </Card>
    )
  }

  const queueStatus = getQueueStatus(healthData.queue_depth)
  const responseStatus = getResponseTimeStatus(healthData.response_time_ms)
  const errorStatus = getErrorRateStatus(healthData.error_rate)

  const getIndicatorClass = (level) => {
    return {
      good: styles.pulseGreen,
      warning: styles.pulseYellow,
      critical: styles.pulseRed,
    }[level]
  }

  const getStatusClass = (level) => {
    return {
      good: styles.statusGood,
      warning: styles.statusWarning,
      critical: styles.statusCritical,
    }[level]
  }

  return (
    <Card className={styles.card}>
      <CardHeader
        header={
          <div className={styles.header}>
            <Text size={400} weight="semibold">
              System Health Monitor
            </Text>
            <Badge appearance="filled" color="success">
              Live
            </Badge>
          </div>
        }
      />

      <div className={styles.metricsGrid}>
        <div className={styles.metric}>
          <div className={styles.metricHeader}>
            <Text className={styles.metricLabel}>Queue Depth</Text>
            <Circle20Filled className={getIndicatorClass(queueStatus.level)} />
          </div>
          <Text className={styles.metricValue}>{healthData.queue_depth}</Text>
          <Text className={`${styles.statusText} ${getStatusClass(queueStatus.level)}`}>
            {queueStatus.label}
          </Text>
        </div>

        <div className={styles.metric}>
          <div className={styles.metricHeader}>
            <Text className={styles.metricLabel}>Active Connections</Text>
            <Circle20Filled className={styles.pulseGreen} />
          </div>
          <Text className={styles.metricValue}>{healthData.active_connections}</Text>
          <Text className={`${styles.statusText} ${styles.statusGood}`}>
            Normal
          </Text>
        </div>

        <div className={styles.metric}>
          <div className={styles.metricHeader}>
            <Text className={styles.metricLabel}>Response Time</Text>
            <Circle20Filled className={getIndicatorClass(responseStatus.level)} />
          </div>
          <Text className={styles.metricValue}>{healthData.response_time_ms}ms</Text>
          <Text className={`${styles.statusText} ${getStatusClass(responseStatus.level)}`}>
            {responseStatus.label}
          </Text>
        </div>

        <div className={styles.metric}>
          <div className={styles.metricHeader}>
            <Text className={styles.metricLabel}>Error Rate</Text>
            <Circle20Filled className={getIndicatorClass(errorStatus.level)} />
          </div>
          <Text className={styles.metricValue}>{healthData.error_rate}%</Text>
          <Text className={`${styles.statusText} ${getStatusClass(errorStatus.level)}`}>
            {errorStatus.label}
          </Text>
        </div>
      </div>

      {error && (
        <Text className={styles.timestamp} style={{ color: tokens.colorPaletteRedForeground1 }}>
          {error}
        </Text>
      )}
      
      <Text className={styles.timestamp}>
        Last update: {formatTimestamp(healthData.timestamp)}
      </Text>
    </Card>
  )
}
