/**
 * SupportDashboard Component
 *
 * Main IT Support Dashboard container that assembles all dashboard components
 * with live data from the backend API and real-time SSE updates
 *
 * Following principles:
 * - State management with React hooks
 * - API calls isolated in useEffect
 * - Responsive grid layout
 * - Loading and error states
 */

import { useState, useEffect } from 'react'
import {
  makeStyles,
  tokens,
  Spinner,
  Text,
  Dropdown,
  Option,
} from '@fluentui/react-components'
import {
  DocumentBulletListClock24Regular,
  ClipboardTaskListLtr24Regular,
  Timer24Regular,
  StarEmphasis24Regular,
} from '@fluentui/react-icons'
import {
  getSupportStats,
  getTicketTrends,
  getCategoryBreakdown,
  getSeverityMetrics,
  getTechnicianPerformance,
} from '../../services/api'
import MetricCard from './MetricCard'
import TicketTrendsChart from './TicketTrendsChart'
import CategoryPieChart from './CategoryPieChart'
import SeverityBarChart from './SeverityBarChart'
import TechnicianTable from './TechnicianTable'
import SystemHealthMonitor from './SystemHealthMonitor'

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalL,
    flexWrap: 'wrap',
    gap: tokens.spacingVerticalM,
  },
  title: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
  },
  dashboard: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, 1fr)',
    gap: tokens.spacingVerticalL,
  },
  metricGrid: {
    gridColumn: 'span 12',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: tokens.spacingVerticalM,
  },
  chartHalf: {
    gridColumn: 'span 12',
    '@media (min-width: 768px)': {
      gridColumn: 'span 6',
    },
  },
  chartFull: {
    gridColumn: 'span 12',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    gap: tokens.spacingVerticalM,
  },
  error: {
    padding: tokens.spacingVerticalXXL,
    textAlign: 'center',
    color: tokens.colorPaletteRedForeground1,
  },
  timeRangeSelector: {
    minWidth: '150px',
  },
})

// ============================================================================
// CALCULATIONS - Pure functions
// ============================================================================

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SupportDashboard() {
  const styles = useStyles()

  // State management
  const [stats, setStats] = useState(null)
  const [trends, setTrends] = useState(null)
  const [categories, setCategories] = useState(null)
  const [severity, setSeverity] = useState(null)
  const [technicians, setTechnicians] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timeRange, setTimeRange] = useState('24h')

  // Fetch all dashboard data
  const loadDashboardData = async (period = timeRange) => {
    setLoading(true)
    setError(null)

    try {
      // Fetch all data in parallel
      const [statsData, trendsData, categoriesData, severityData, techniciansData] = 
        await Promise.all([
          getSupportStats(),
          getTicketTrends(period),
          getCategoryBreakdown(),
          getSeverityMetrics(),
          getTechnicianPerformance(),
        ])

      setStats(statsData)
      setTrends(trendsData)
      setCategories(categoriesData)
      setSeverity(severityData)
      setTechnicians(techniciansData)
    } catch (err) {
      console.error('Error loading dashboard data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Load data on mount and when time range changes
  useEffect(() => {
    loadDashboardData()
  }, [timeRange])

  // Handle time range change
  const handleTimeRangeChange = (event, data) => {
    setTimeRange(data.optionValue)
  }

  // Loading state
  if (loading && !stats) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Spinner size="extra-large" />
          <Text size={400}>Loading IT Support Dashboard...</Text>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !stats) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <Text size={500} weight="semibold">
            Error Loading Dashboard
          </Text>
          <Text style={{ marginTop: tokens.spacingVerticalM }}>
            {error}
          </Text>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Header with time range selector */}
      <div className={styles.header}>
        <div>
          <Text className={styles.title}>IT Support Dashboard</Text>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: '4px' }}>
            Real-time support metrics and team performance
          </Text>
        </div>
        <Dropdown
          className={styles.timeRangeSelector}
          value={timeRange === '24h' ? 'Last 24 Hours' : timeRange === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
          selectedOptions={[timeRange]}
          onOptionSelect={handleTimeRangeChange}
          data-testid="time-range-selector"
        >
          <Option value="24h">Last 24 Hours</Option>
          <Option value="7d">Last 7 Days</Option>
          <Option value="30d">Last 30 Days</Option>
        </Dropdown>
      </div>

      <div className={styles.dashboard}>
        {/* Metric Cards Row */}
        <div className={styles.metricGrid} data-testid="metric-cards">
          <div data-testid="total-tickets-card">
            <MetricCard
              title="Total Tickets"
              value={stats?.[`total_${timeRange}`] || 0}
              subtitle={`In ${timeRange === '24h' ? '24 hours' : timeRange === '7d' ? '7 days' : '30 days'}`}
              icon={DocumentBulletListClock24Regular}
              color="info"
              gradient
              loading={loading}
            />
          </div>
          <div data-testid="open-tickets-card">
            <MetricCard
              title="Open Tickets"
              value={stats?.open || 0}
              subtitle={`${stats?.in_progress || 0} in progress`}
              icon={ClipboardTaskListLtr24Regular}
              color="warning"
              gradient
              loading={loading}
            />
          </div>
          <div data-testid="avg-resolution-card">
            <MetricCard
              title="Avg Resolution Time"
              value={stats ? formatTime(stats.avg_resolution_time_minutes) : '—'}
              subtitle={`First response: ${stats ? formatTime(stats.avg_first_response_minutes) : '—'}`}
              icon={Timer24Regular}
              color="primary"
              gradient
              loading={loading}
            />
          </div>
          <div data-testid="satisfaction-card">
            <MetricCard
              title="Satisfaction Score"
              value={stats ? stats.satisfaction_score.toFixed(1) : '—'}
              subtitle={`Uptime: ${stats ? stats.uptime_percent.toFixed(2) : '—'}%`}
              icon={StarEmphasis24Regular}
              color="success"
              gradient
              loading={loading}
            />
          </div>
        </div>

        {/* Charts Row 1: Trends and Categories */}
        <div className={styles.chartHalf} data-testid="trends-chart">
          <TicketTrendsChart
            data={trends}
            period={timeRange}
            loading={loading}
          />
        </div>
        <div className={styles.chartHalf} data-testid="category-chart">
          <CategoryPieChart
            data={categories}
            loading={loading}
          />
        </div>

        {/* Charts Row 2: Severity and System Health */}
        <div className={styles.chartHalf} data-testid="severity-chart">
          <SeverityBarChart
            data={severity}
            loading={loading}
          />
        </div>
        <div className={styles.chartHalf} data-testid="health-monitor">
          <SystemHealthMonitor />
        </div>

        {/* Full Width: Technician Performance Table */}
        <div className={styles.chartFull} data-testid="technician-table">
          <TechnicianTable
            data={technicians}
            loading={loading}
          />
        </div>
      </div>
    </div>
  )
}
