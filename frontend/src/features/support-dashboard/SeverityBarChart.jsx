/**
 * SeverityBarChart Component
 *
 * Horizontal bar chart displaying ticket severity distribution
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

// Severity colors
const SEVERITY_COLORS = {
  Critical: '#d13438',  // Red
  High: '#f7630c',      // Orange
  Medium: '#fde300',    // Yellow
  Low: '#107c10',       // Green
}

// ============================================================================
// CALCULATIONS - Pure functions
// ============================================================================

function transformDataForChart(data) {
  if (!data) return []
  
  return [
    { name: 'Critical', value: data.critical || 0, color: SEVERITY_COLORS.Critical },
    { name: 'High', value: data.high || 0, color: SEVERITY_COLORS.High },
    { name: 'Medium', value: data.medium || 0, color: SEVERITY_COLORS.Medium },
    { name: 'Low', value: data.low || 0, color: SEVERITY_COLORS.Low },
  ]
}

function calculateTotal(data) {
  if (!data) return 0
  return (data.critical || 0) + (data.high || 0) + (data.medium || 0) + (data.low || 0)
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SeverityBarChart({ data, loading = false }) {
  const styles = useStyles()

  const chartData = transformDataForChart(data)
  const total = calculateTotal(data)

  if (loading) {
    return (
      <Card className={styles.card}>
        <div className={styles.loading}>
          <Spinner label="Loading severity metrics..." />
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
              Severity Distribution
            </Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              Total: {total} tickets
            </Text>
          </div>
        }
      />
      
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={tokens.colorNeutralStroke2} />
            <XAxis
              type="number"
              stroke={tokens.colorNeutralForeground3}
              style={{ fontSize: tokens.fontSizeBase200 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke={tokens.colorNeutralForeground3}
              style={{ fontSize: tokens.fontSizeBase200 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: tokens.colorNeutralBackground1,
                border: `1px solid ${tokens.colorNeutralStroke1}`,
                borderRadius: tokens.borderRadiusMedium,
              }}
              formatter={(value, name, props) => {
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0
                return [`${value} tickets (${percentage}%)`, name]
              }}
            />
            <Legend />
            <Bar
              dataKey="value"
              name="Tickets"
              radius={[0, 8, 8, 0]}
              label={{ position: 'right', fill: tokens.colorNeutralForeground1 }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
