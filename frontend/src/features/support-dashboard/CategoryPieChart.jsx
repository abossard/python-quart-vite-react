/**
 * CategoryPieChart Component
 *
 * Pie/Donut chart displaying ticket breakdown by category
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

// Default colors matching the plan
const CATEGORY_COLORS = {
  Hardware: '#0078d4',    // Blue
  Software: '#8764b8',    // Purple
  Network: '#107c10',     // Green
  Security: '#d13438',    // Red
  Other: '#605e5c',       // Gray
}

// ============================================================================
// CALCULATIONS - Pure functions
// ============================================================================

function transformDataForChart(data) {
  if (!data || !data.categories) return []
  
  return data.categories.map(category => ({
    name: category.name,
    value: category.count,
    percentage: category.percentage,
    color: category.color || CATEGORY_COLORS[category.name] || '#605e5c',
  }))
}

// Custom label for pie chart
function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percentage }) {
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      style={{ fontSize: '12px', fontWeight: 600 }}
    >
      {`${percentage.toFixed(1)}%`}
    </text>
  )
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function CategoryPieChart({ data, loading = false }) {
  const styles = useStyles()

  const chartData = transformDataForChart(data)
  const total = data?.total || chartData.reduce((sum, item) => sum + item.value, 0)

  if (loading) {
    return (
      <Card className={styles.card}>
        <div className={styles.loading}>
          <Spinner label="Loading categories..." />
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
              Category Breakdown
            </Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              Total: {total} tickets
            </Text>
          </div>
        }
      />
      
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={100}
              innerRadius={60}
              fill="#8884d8"
              dataKey="value"
              paddingAngle={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: tokens.colorNeutralBackground1,
                border: `1px solid ${tokens.colorNeutralStroke1}`,
                borderRadius: tokens.borderRadiusMedium,
              }}
              formatter={(value, name, props) => [
                `${value} tickets (${props.payload.percentage.toFixed(1)}%)`,
                name,
              ]}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
