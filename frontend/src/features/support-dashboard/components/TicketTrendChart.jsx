/**
 * TicketTrendChart Component
 *
 * Line/Area chart showing ticket trends over time
 * (created, resolved, open tickets)
 */

import {
  Card,
  CardHeader,
  Text,
  makeStyles,
  tokens,
  Spinner,
} from '@fluentui/react-components'
import { ChartMultiple24Regular } from '@fluentui/react-icons'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
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
    height: '400px',
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

export default function TicketTrendChart({ data, loading }) {
  const styles = useStyles()

  if (loading) {
    return (
      <Card className={styles.card}>
        <Spinner label="Loading trends..." />
      </Card>
    )
  }

  return (
    <Card className={styles.card} data-testid="chart-ticket-trends">
      <CardHeader
        header={
          <div className={styles.header}>
            <ChartMultiple24Regular style={{ fontSize: '20px' }} />
            <Text weight="semibold" size={400}>Ticket Trends (30 Days)</Text>
          </div>
        }
        description={<Text size={200}>Daily ticket activity over the last month</Text>}
      />
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(value) => {
                const date = new Date(value)
                return `${date.getMonth() + 1}/${date.getDate()}`
              }}
            />
            <YAxis />
            <Tooltip 
              labelFormatter={(value) => new Date(value).toLocaleDateString()}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="created"
              stackId="1"
              stroke={tokens.colorPaletteBlueForeground1}
              fill={tokens.colorPaletteBlueForeground1}
              fillOpacity={0.6}
              name="Created"
            />
            <Area
              type="monotone"
              dataKey="resolved"
              stackId="2"
              stroke={tokens.colorPaletteGreenForeground1}
              fill={tokens.colorPaletteGreenForeground1}
              fillOpacity={0.6}
              name="Resolved"
            />
            <Line
              type="monotone"
              dataKey="open"
              stroke={tokens.colorPaletteOrangeForeground1}
              strokeWidth={2}
              name="Open"
              dot={{ r: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
