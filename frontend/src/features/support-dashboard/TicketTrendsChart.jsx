/**
 * TicketTrendsChart Component
 *
 * Line chart displaying ticket trends over time (created, resolved, escalated)
 * Uses Recharts for visualization
 */

import {
  Card,
  CardHeader,
  Text,
  makeStyles,
  tokens,
  Spinner,
} from '@fluentui/react-components'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

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
    minHeight: '300px',
  },
  chartContainer: {
    width: '100%',
    height: '300px',
  },
})

// ============================================================================
// CALCULATIONS - Pure functions
// ============================================================================

function formatTimestamp(timestamp, period) {
  const date = new Date(timestamp)
  
  if (period === '24h') {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
  } else if (period === '7d') {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

function transformDataForChart(data, period) {
  if (!data || !data.data) return []
  
  return data.data.map(point => ({
    time: formatTimestamp(point.timestamp, period),
    Created: point.created,
    Resolved: point.resolved,
    Escalated: point.escalated,
  }))
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function TicketTrendsChart({ data, period = '24h', loading = false }) {
  const styles = useStyles()

  const chartData = transformDataForChart(data, period)

  const periodLabel = {
    '24h': 'Last 24 Hours',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
  }[period] || 'Trends'

  if (loading) {
    return (
      <Card className={styles.card}>
        <div className={styles.loading}>
          <Spinner label="Loading trends..." />
        </div>
      </Card>
    )
  }

  return (
    <Card className={styles.card}>
      <CardHeader
        header={
          <div className={styles.header}>
            <Text size={400} weight="semibold">
              Ticket Trends
            </Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              {periodLabel}
            </Text>
          </div>
        }
      />
      
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={tokens.colorNeutralStroke2} />
            <XAxis
              dataKey="time"
              stroke={tokens.colorNeutralForeground3}
              style={{ fontSize: tokens.fontSizeBase200 }}
            />
            <YAxis
              stroke={tokens.colorNeutralForeground3}
              style={{ fontSize: tokens.fontSizeBase200 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: tokens.colorNeutralBackground1,
                border: `1px solid ${tokens.colorNeutralStroke1}`,
                borderRadius: tokens.borderRadiusMedium,
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="Created"
              stroke={tokens.colorPaletteBlueForeground1}
              strokeWidth={2}
              dot={{ fill: tokens.colorPaletteBlueForeground1 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="Resolved"
              stroke={tokens.colorPaletteGreenForeground1}
              strokeWidth={2}
              dot={{ fill: tokens.colorPaletteGreenForeground1 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="Escalated"
              stroke={tokens.colorPaletteRedForeground1}
              strokeWidth={2}
              dot={{ fill: tokens.colorPaletteRedForeground1 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
