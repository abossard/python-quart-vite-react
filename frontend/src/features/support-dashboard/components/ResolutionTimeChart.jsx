/**
 * ResolutionTimeChart Component
 *
 * Bar chart showing distribution of resolution times
 */

import {
  Card,
  CardHeader,
  Text,
  makeStyles,
  tokens,
  Spinner,
} from '@fluentui/react-components'
import { Timer24Regular } from '@fluentui/react-icons'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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

export default function ResolutionTimeChart({ data, loading }) {
  const styles = useStyles()

  if (loading) {
    return (
      <Card className={styles.card}>
        <Spinner label="Loading resolution data..." />
      </Card>
    )
  }

  // Transform data for bar chart
  const chartData = Object.entries(data || {}).map(([range, count]) => ({
    range,
    count,
  }))

  return (
    <Card className={styles.card} data-testid="chart-resolution-time">
      <CardHeader
        header={
          <div className={styles.header}>
            <Timer24Regular style={{ fontSize: '20px' }} />
            <Text weight="semibold" size={400}>Resolution Time Distribution</Text>
          </div>
        }
        description={<Text size={200}>Time to resolve tickets</Text>}
      />
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" />
            <YAxis />
            <Tooltip />
            <Bar 
              dataKey="count" 
              fill={tokens.colorPalettePurpleForeground1}
              name="Tickets"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
