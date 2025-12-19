/**
 * Main Application Component
 *
 * Demonstrates FluentUI Tab navigation and component composition
 * Following A Philosophy of Software Design:
 * - Deep modules: Each feature is self-contained
 * - Clear interfaces: Props and state flow is explicit
 */

import {
  makeStyles,
  Title2,
  Tab,
  TabList,
  tokens,
  shorthands,
} from '@fluentui/react-components'
import {
  DocumentSearch24Regular,
} from '@fluentui/react-icons'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import TicketSearch from './features/tickets/TicketSearch'

const useStyles = makeStyles({
  app: {
    minHeight: '100vh',
    backgroundColor: '#f7f7f7',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    backgroundColor: '#ffffff',
    ...shorthands.borderBottom('1px', 'solid', '#e5e5e5'),
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalXXL),
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalM),
  },
  logo: {
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
  },
  title: {
    color: '#444444',
    fontWeight: 400,
    fontSize: '22px',
    margin: 0,
    letterSpacing: '0.5px',
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalM),
  },
  content: {
    flex: 1,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
})

export default function App() {
  const styles = useStyles()
  const location = useLocation()
  const navigate = useNavigate()
  const tabs = [
    { value: 'tickets', label: 'Tickets', icon: <DocumentSearch24Regular />, path: '/tickets', testId: 'tab-tickets' },
  ]
  const activeTab = tabs.find((tab) => location.pathname.startsWith(tab.path))?.value ?? 'tickets'

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.leftSection}>
            <div className={styles.logo}>🇨🇭</div>
            <h1 className={styles.title}>KBA Coach</h1>
          </div>
        </div>
      </header>

      <main className={styles.content}>
        <Routes>
          <Route path="/" element={<Navigate to="/tickets" replace />} />
          <Route path="/tickets" element={<TicketSearch />} />
          <Route path="*" element={<Navigate to="/tickets" replace />} />
        </Routes>
      </main>
    </div>
  )
}
