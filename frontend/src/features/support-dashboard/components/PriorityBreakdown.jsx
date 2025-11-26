/**
 * PriorityBreakdown Component
 *
 * Horizontal bar chart showing tickets by priority level
 */

import {
  Card,
  CardHeader,
  Text,
  makeStyles,
  tokens,
  Spinner,
} from '@fluentui/react-components'
import { Alert24Regular } from '@fluentui/react-icons'
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
    height: '300px',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  chartContainer: {
    flex: 1,
    marginTop: tokens.spacingVerticalM,
  },
})

const PRIORITY_COLORS = {
  critical: tokens.colorPaletteRedForeground1,
  high: tokens.colorPaletteOrangeForeground1,
  medium: tokens.colorPaletteBlueForeground1,
  low: tokens.colorPaletteGreenForeground1,
}

export default function PriorityBreakdown({ data, loading }) {
  const styles = useStyles()

  if (loading) {
    return (
      <Card className={styles.card}>
        <Spinner label="Loading priority data..." />
      </Card>
    )
  }

  // Transform data for bar chart
  const chartData = Object.entries(data || {})
    .map(([priority, value]) => ({
      priority: priority.toUpperCase(),
      count: value,
      color: PRIORITY_COLORS[priority] || tokens.colorNeutralForeground2,
    }))
    .sort((a, b) => {
      const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
      return order[a.priority] - order[b.priority]
    })

  return (
    <Card className={styles.card} data-testid="chart-priority-breakdown">
      <CardHeader
        header={
          <div className={styles.header}>
            <Alert24Regular style={{ fontSize: '20px' }} />
            <Text weight="semibold" size={400}>Priority Breakdown</Text>
          </div>
        }
        description={<Text size={200}>Tickets by priority level</Text>}
      />
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="priority" width={80} />
            <Tooltip />
            <Bar dataKey="count" name="Tickets">
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
