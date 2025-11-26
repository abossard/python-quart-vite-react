/**
 * PriorityChart Component
 *
 * Bar chart displaying open tasks by priority level
 * Uses Recharts library with FluentUI theming
 *
 * Following principles:
 * - Pure component with data passed as props
 * - Color coding: Green (Low), Yellow (Medium), Red (High)
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { makeStyles, tokens, Text } from '@fluentui/react-components'

const useStyles = makeStyles({
  container: {
    width: '100%',
    height: '300px',
  },
  title: {
    marginBottom: tokens.spacingVerticalM,
  },
})

// Priority colors matching the requirement
const PRIORITY_COLORS = {
  Low: '#107C10',      // Green
  Medium: '#FDE300',   // Yellow
  High: '#D13438',     // Red
}

export default function PriorityChart({ data }) {
  const styles = useStyles()

  // Transform data for Recharts format
  const chartData = [
    { priority: 'Low', count: data?.low || 0 },
    { priority: 'Medium', count: data?.medium || 0 },
    { priority: 'High', count: data?.high || 0 },
  ]

  return (
    <div>
      <Text size={400} weight="semibold" className={styles.title}>
        Offene Tickets nach Priorität
      </Text>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="priority" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="count" name="Anzahl offener Tickets">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.priority]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
