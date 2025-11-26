/**
 * CategoryDistribution Component
 *
 * Pie/Donut chart showing ticket distribution by category
 */

import {
  Card,
  CardHeader,
  Text,
  makeStyles,
  tokens,
  Spinner,
} from '@fluentui/react-components'
import { DataPie24Regular } from '@fluentui/react-icons'
import {
  PieChart,
  Pie,
  Cell,
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

// Category colors matching the plan
const CATEGORY_COLORS = {
  hardware: '#0078D4',
  software: '#8764B8',
  network: '#00CC6A',
  email: '#FF8C00',
  security: '#D13438',
  account_access: '#FFB900',
  printer: '#00B7C3',
  other: '#737373',
}

export default function CategoryDistribution({ data, loading }) {
  const styles = useStyles()

  if (loading) {
    return (
      <Card className={styles.card}>
        <Spinner label="Loading category data..." />
      </Card>
    )
  }

  // Transform data for pie chart
  const chartData = Object.entries(data || {})
    .filter(([_, value]) => value > 0)
    .map(([category, value]) => ({
      name: category.replace('_', ' ').toUpperCase(),
      value,
      color: CATEGORY_COLORS[category] || '#737373',
    }))

  return (
    <Card className={styles.card} data-testid="chart-category-distribution">
      <CardHeader
        header={
          <div className={styles.header}>
            <DataPie24Regular style={{ fontSize: '20px' }} />
            <Text weight="semibold" size={400}>Category Distribution</Text>
          </div>
        }
        description={<Text size={200}>Tickets by category</Text>}
      />
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
