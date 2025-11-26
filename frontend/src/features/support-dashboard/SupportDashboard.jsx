/**
 * SupportDashboard Component
 *
 * Main container for IT Support Dashboard
 * Displays KPIs, charts, and real-time data from support ticket system
 */

import { useEffect, useState } from 'react'
import {
  makeStyles,
  tokens,
  Spinner,
  Text,
} from '@fluentui/react-components'
import {
  DocumentBulletList24Regular,
  Timer24Regular,
  CheckmarkCircle24Regular,
  Star24Regular,
  Alert24Regular,
} from '@fluentui/react-icons'
import {
  getDashboardStats,
  getTicketTrends,
  getCategoryPerformance,
  getResolutionDistribution,
  getSupportTickets,
  connectToStatsStream,
} from '../../services/api'

// Import components
import KPICard from './components/KPICard'
import TicketTrendChart from './components/TicketTrendChart'
import CategoryDistribution from './components/CategoryDistribution'
import PriorityBreakdown from './components/PriorityBreakdown'
import ResolutionTimeChart from './components/ResolutionTimeChart'
import RecentTickets from './components/RecentTickets'
import { TicketDetailModal } from './components/TicketDetailModal'
import { FilteredTicketsModal } from './components/FilteredTicketsModal'

const useStyles = makeStyles({
  dashboard: {
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: tokens.spacingHorizontalM,
  },
  chartsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: tokens.spacingHorizontalM,
  },
  detailsRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingHorizontalM,
  },
  bottomRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingHorizontalM,
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  },
  header: {
    marginBottom: tokens.spacingVerticalM,
  },
  title: {
    fontSize: '28px',
    fontWeight: 600,
  },
  subtitle: {
    fontSize: '14px',
    color: tokens.colorNeutralForeground2,
    marginTop: tokens.spacingVerticalXS,
  },
})

export default function SupportDashboard() {
  const styles = useStyles()
  
  console.log('SupportDashboard component rendering')
  
  // State
  const [stats, setStats] = useState(null)
  const [trends, setTrends] = useState([])
  const [performance, setPerformance] = useState([])
  const [resolutionDist, setResolutionDist] = useState({})
  const [recentTickets, setRecentTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [ticketFilter, setTicketFilter] = useState(null)
  const [filterTitle, setFilterTitle] = useState('')

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        console.log('Fetching dashboard data...')
        
        const [
          statsData,
          trendsData,
          performanceData,
          resolutionData,
          ticketsData,
        ] = await Promise.all([
          getDashboardStats(),
          getTicketTrends(30),
          getCategoryPerformance(),
          getResolutionDistribution(),
          getSupportTickets({ limit: 20 }),
        ])

        console.log('Dashboard data loaded:', { statsData, trendsData, performanceData, resolutionData, ticketsData })
        setStats(statsData)
        setTrends(trendsData)
        setPerformance(performanceData)
        setResolutionDist(resolutionData)
        setRecentTickets(ticketsData)
        setError(null)
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Connect to live stats stream
  useEffect(() => {
    const cleanup = connectToStatsStream(
      (data) => {
        setStats(data)
        setIsConnected(true)
      },
      (err) => {
        console.error('Stats stream error:', err)
        setIsConnected(false)
      }
    )

    return cleanup
  }, [])

  // Handlers
  const handleViewDetails = (ticket) => {
    setSelectedTicket(ticket)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedTicket(null)
  }

  const handleTicketUpdate = async (updatedTicket) => {
    // Update the ticket in the list
    setRecentTickets((prevTickets) =>
      prevTickets.map((t) => (t.id === updatedTicket.id ? updatedTicket : t))
    )
    // Update selected ticket to show new worklog
    setSelectedTicket(updatedTicket)
    
    // Refresh stats to update counts (especially if ticket was closed)
    try {
      const freshStats = await getDashboardStats()
      setStats(freshStats)
    } catch (err) {
      console.error('Error refreshing stats:', err)
    }
  }

  const handleKPIClick = (filter, title) => {
    setTicketFilter(filter)
    setFilterTitle(title)
    setFilterModalOpen(true)
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spinner size="extra-large" label="Loading dashboard..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.loadingContainer}>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <Text style={{ color: 'red', fontSize: '18px', marginBottom: '10px', display: 'block' }}>
            Error loading dashboard: {error}
          </Text>
          <Text style={{ display: 'block', marginTop: '20px' }}>
            Check that the backend is running at http://localhost:5001
          </Text>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Safely check for stats data
  if (!stats) {
    return (
      <div className={styles.loadingContainer}>
        <Text>No data available</Text>
      </div>
    )
  }

  // Calculate formatted values
  const formatResolutionTime = (hours) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`
    if (hours < 24) return `${Math.round(hours)}h`
    return `${Math.round(hours / 24)}d`
  }

  const criticalCount = stats?.tickets_by_priority?.critical || 0

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <Text className={styles.title}>IT Support Dashboard</Text>
        <Text className={styles.subtitle}>
          Real-time monitoring of support tickets and team performance
          {isConnected && ' • Live updates enabled ✓'}
        </Text>
      </div>

      {/* KPI Cards Row */}
      <div className={styles.kpiRow}>
        <KPICard
          icon={DocumentBulletList24Regular}
          label="Total Open Tickets"
          value={stats?.open_tickets || 0}
          subtitle={`${stats?.in_progress_tickets || 0} in progress`}
          color={tokens.colorPaletteBlueForeground1}
          testId="kpi-total-open"
          onClick={() => handleKPIClick({ isOpen: true }, 'All Open Tickets')}
        />
        <KPICard
          icon={Timer24Regular}
          label="Avg Resolution Time"
          value={formatResolutionTime(stats?.avg_resolution_time_hours || 0)}
          subtitle="Average time to resolve"
          color={tokens.colorPaletteGreenForeground1}
          testId="kpi-avg-resolution"
        />
        <KPICard
          icon={CheckmarkCircle24Regular}
          label="Resolved Today"
          value={stats?.resolved_today || 0}
          subtitle="Tickets closed today"
          color={tokens.colorPalettePurpleForeground1}
          testId="kpi-resolved-today"
          onClick={() => handleKPIClick({ resolvedToday: true }, 'Tickets Resolved Today')}
        />
        <KPICard
          icon={Star24Regular}
          label="Customer Satisfaction"
          value={`${stats?.customer_satisfaction_avg?.toFixed(1) || '0.0'}/5.0`}
          subtitle="Average rating"
          color={tokens.colorPaletteOrangeForeground1}
          testId="kpi-satisfaction"
        />
        <KPICard
          icon={Alert24Regular}
          label="Critical Priority"
          value={criticalCount}
          subtitle="Urgent tickets"
          color={tokens.colorPaletteRedForeground1}
          testId="kpi-critical"
          onClick={() => handleKPIClick({ priority: 'critical' }, 'Critical Priority Tickets')}
        />
      </div>

      {/* Main Charts Row */}
      <div className={styles.chartsRow}>
        <TicketTrendChart data={trends} loading={false} />
        <CategoryDistribution data={stats?.tickets_by_category} loading={false} />
      </div>

      {/* Details Row */}
      <div className={styles.bottomRow}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
          <PriorityBreakdown data={stats?.tickets_by_priority} loading={false} />
          <ResolutionTimeChart data={resolutionDist} loading={false} />
        </div>
        <RecentTickets tickets={recentTickets} loading={false} onViewDetails={handleViewDetails} />
      </div>

      {/* Ticket Detail Modal */}
      <TicketDetailModal
        ticket={selectedTicket}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onUpdate={handleTicketUpdate}
      />

      {/* Filtered Tickets Modal */}
      <FilteredTicketsModal
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        filter={ticketFilter}
        title={filterTitle}
        onViewDetails={handleViewDetails}
      />
    </div>
  )
}
