/**
 * Dashboard Component
 *
 * Displays real-time server information using Server-Sent Events
 * Demonstrates FluentUI Card and Text components with colorful metrics and charts
 */

import { useEffect, useState } from 'react'
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
  Clock24Regular,
  CalendarLtr24Regular,
  ChartMultiple24Regular,
  DataUsage24Regular,
  People24Regular,
  Checkmark24Regular,
  ArrowUp24Regular,
  Server24Regular,
} from '@fluentui/react-icons'
import { connectToTimeStream, getCurrentDate } from '../../services/api'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  RadialBarChart,
  RadialBar,
} from 'recharts'

const useStyles = makeStyles({
  dashboard: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalL,
  },
  card: {
    padding: tokens.spacingVerticalL,
  },
  cardSuccess: {
    padding: tokens.spacingVerticalL,
    backgroundColor: tokens.colorPaletteGreenBackground2,
    borderLeft: `4px solid ${tokens.colorPaletteGreenBorder2}`,
  },
  cardWarning: {
    padding: tokens.spacingVerticalL,
    backgroundColor: tokens.colorPaletteYellowBackground2,
    borderLeft: `4px solid ${tokens.colorPaletteYellowBorder2}`,
  },
  cardInfo: {
    padding: tokens.spacingVerticalL,
    backgroundColor: tokens.colorPaletteBlueBorder1,
    borderLeft: `4px solid ${tokens.colorPaletteBlueBorder2}`,
  },
  cardPurple: {
    padding: tokens.spacingVerticalL,
    backgroundColor: tokens.colorPalettePurpleBackground2,
    borderLeft: `4px solid ${tokens.colorPalettePurpleBorder2}`,
  },
  cardRed: {
    padding: tokens.spacingVerticalL,
    backgroundColor: tokens.colorPaletteRedBackground2,
    borderLeft: `4px solid ${tokens.colorPaletteRedBorder2}`,
  },
  timeDisplay: {
    fontSize: '48px',
    fontWeight: 'bold',
    color: tokens.colorBrandForeground1,
    fontVariantNumeric: 'tabular-nums',
  },
  dateDisplay: {
    fontSize: '24px',
    color: tokens.colorNeutralForeground2,
  },
  metricValue: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: tokens.colorBrandForeground1,
  },
  metricChange: {
    fontSize: '14px',
    fontWeight: 'semibold',
  },
  label: {
    fontSize: '14px',
    color: tokens.colorNeutralForeground3,
    marginBottom: tokens.spacingVerticalS,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  chartContainer: {
    height: '200px',
    marginTop: tokens.spacingVerticalM,
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
})

// Sample data generators
const generateWeeklyData = () => {
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
  return days.map((day) => ({
    name: day,
    wert: Math.floor(Math.random() * 100) + 50,
    ziel: 80,
  }))
}

const generateMonthlyData = () => {
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun']
  return months.map((month) => ({
    name: month,
    umsatz: Math.floor(Math.random() * 5000) + 3000,
    kosten: Math.floor(Math.random() * 3000) + 1500,
  }))
}

const generateCategoryData = () => [
  { name: 'Frontend', value: 35, color: '#0078d4' },
  { name: 'Backend', value: 28, color: '#50e6ff' },
  { name: 'DevOps', value: 20, color: '#00b7c3' },
  { name: 'Design', value: 17, color: '#8764b8' },
]

const generatePerformanceData = () => [
  { name: 'Performance', value: 85, fill: '#10b981' },
  { name: 'Verbleibend', value: 15, fill: '#e5e7eb' },
]

export default function Dashboard() {
  const styles = useStyles()
  const [liveTime, setLiveTime] = useState(null)
  const [serverDate, setServerDate] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)

  // Fictional metrics state
  const [weeklyData] = useState(generateWeeklyData())
  const [monthlyData] = useState(generateMonthlyData())
  const [categoryData] = useState(generateCategoryData())
  const [performanceData] = useState(generatePerformanceData())
  const [systemMetrics] = useState({
    activeUsers: Math.floor(Math.random() * 500) + 1200,
    userChange: '+12%',
    completedTasks: Math.floor(Math.random() * 200) + 450,
    taskChange: '+8%',
    serverUptime: '99.9%',
    uptimeChange: '+0.1%',
    avgResponseTime: Math.floor(Math.random() * 50) + 120,
    responseChange: '-15ms',
  })

  // Fetch initial server date
  useEffect(() => {
    getCurrentDate()
      .then(setServerDate)
      .catch((err) => setError(err.message))
  }, [])

  // Connect to live time stream
  useEffect(() => {
    const cleanup = connectToTimeStream(
      (data) => {
        setLiveTime(data)
        setIsConnected(true)
        setError(null)
      },
      (err) => {
        setError('Connection lost')
        setIsConnected(false)
      }
    )

    return cleanup
  }, [])

  return (
    <div className={styles.dashboard}>
      {/* Active Users Metric */}
      <Card className={styles.cardSuccess}>
        <CardHeader
          header={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <People24Regular />
              <Text weight="semibold">Aktive Benutzer</Text>
            </div>
          }
          description={<Badge appearance="tint" color="success">Live</Badge>}
        />
        <div className={styles.content}>
          <div className={styles.metricRow}>
            <div className={styles.metricValue}>{systemMetrics.activeUsers.toLocaleString()}</div>
            <Text className={styles.metricChange} style={{ color: tokens.colorPaletteGreenForeground1 }}>
              <ArrowUp24Regular /> {systemMetrics.userChange}
            </Text>
          </div>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData}>
                <XAxis dataKey="name" stroke={tokens.colorNeutralForeground3} />
                <YAxis stroke={tokens.colorNeutralForeground3} />
                <Tooltip />
                <Line type="monotone" dataKey="wert" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} />
                <Line type="monotone" dataKey="ziel" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Task Completion Metric */}
      <Card className={styles.cardInfo}>
        <CardHeader
          header={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Checkmark24Regular />
              <Text weight="semibold">Erledigte Aufgaben</Text>
            </div>
          }
          description={<Badge appearance="tint" color="informative">Heute</Badge>}
        />
        <div className={styles.content}>
          <div className={styles.metricRow}>
            <div className={styles.metricValue}>{systemMetrics.completedTasks}</div>
            <Text className={styles.metricChange} style={{ color: tokens.colorPaletteBlueForeground1 }}>
              {systemMetrics.taskChange}
            </Text>
          </div>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <XAxis dataKey="name" stroke={tokens.colorNeutralForeground3} />
                <YAxis stroke={tokens.colorNeutralForeground3} />
                <Tooltip />
                <Bar dataKey="wert" fill="#0078d4" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Server Uptime */}
      <Card className={styles.cardPurple}>
        <CardHeader
          header={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server24Regular />
              <Text weight="semibold">Server Verfügbarkeit</Text>
            </div>
          }
          description={<Badge appearance="tint" color="important">30 Tage</Badge>}
        />
        <div className={styles.content}>
          <div className={styles.metricRow}>
            <div className={styles.metricValue}>{systemMetrics.serverUptime}</div>
            <Text className={styles.metricChange} style={{ color: tokens.colorPalettePurpleForeground1 }}>
              {systemMetrics.uptimeChange}
            </Text>
          </div>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart 
                innerRadius="50%" 
                outerRadius="100%" 
                data={performanceData}
                startAngle={180}
                endAngle={0}
              >
                <RadialBar dataKey="value" cornerRadius={10} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Response Time */}
      <Card className={styles.cardWarning}>
        <CardHeader
          header={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DataUsage24Regular />
              <Text weight="semibold">Ø Antwortzeit</Text>
            </div>
          }
          description={<Badge appearance="tint" color="warning">Millisekunden</Badge>}
        />
        <div className={styles.content}>
          <div className={styles.metricRow}>
            <div className={styles.metricValue}>{systemMetrics.avgResponseTime}ms</div>
            <Text className={styles.metricChange} style={{ color: tokens.colorPaletteGreenForeground1 }}>
              {systemMetrics.responseChange}
            </Text>
          </div>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <XAxis dataKey="name" stroke={tokens.colorNeutralForeground3} />
                <YAxis stroke={tokens.colorNeutralForeground3} />
                <Tooltip />
                <Area type="monotone" dataKey="wert" stroke="#f59e0b" fill="#fde68a" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Monthly Revenue/Cost Chart */}
      <Card className={styles.card} style={{ gridColumn: 'span 2' }}>
        <CardHeader
          header={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ChartMultiple24Regular />
              <Text weight="semibold">Umsatz & Kosten Übersicht</Text>
            </div>
          }
          description={<Text size={200}>Letzte 6 Monate</Text>}
        />
        <div className={styles.content}>
          <div className={styles.chartContainer} style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <XAxis dataKey="name" stroke={tokens.colorNeutralForeground3} />
                <YAxis stroke={tokens.colorNeutralForeground3} />
                <Tooltip />
                <Legend />
                <Bar dataKey="umsatz" fill="#10b981" name="Umsatz (€)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="kosten" fill="#ef4444" name="Kosten (€)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Category Distribution */}
      <Card className={styles.card}>
        <CardHeader
          header={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ChartMultiple24Regular />
              <Text weight="semibold">Projektverteilung</Text>
            </div>
          }
          description={<Text size={200}>Nach Kategorie</Text>}
        />
        <div className={styles.content}>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Live Server Time */}
      <Card className={styles.card}>
        <CardHeader
          header={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock24Regular />
              <Text weight="semibold">Live Server Zeit</Text>
            </div>
          }
          description={
            isConnected ? (
              <Badge appearance="tint" color="success">Verbunden</Badge>
            ) : (
              <Badge appearance="outline">Verbinde...</Badge>
            )
          }
        />
        <div className={styles.content}>
          {liveTime ? (
            <>
              <div className={styles.timeDisplay} data-testid="live-time">
                {liveTime.time}
              </div>
              <div className={styles.dateDisplay}>{liveTime.date}</div>
            </>
          ) : (
            <Spinner label="Verbinde mit Server..." />
          )}
        </div>
      </Card>
    </div>
  )
}
