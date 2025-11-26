/**
 * Main Application Component
 *
 * Demonstrates FluentUI Tab navigation and component composition
 * Following A Philosophy of Software Design:
 * - Deep modules: Each feature is self-contained
 * - Clear interfaces: Props and state flow is explicit
 */

import { useEffect } from 'react'
import {
  makeStyles,
  Subtitle1,
  Tab,
  TabList,
  Text,
  tokens,
} from '@fluentui/react-components'
import {
  Home24Regular,
  Info24Regular,
  TaskListLtr24Regular,
  DocumentBulletList24Regular,
  Bot24Regular,
} from '@fluentui/react-icons'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import About from './components/About'
import Dashboard from './features/dashboard/Dashboard'
import TaskList from './features/tasks/TaskList'
import TicketOverview from './features/overview/TicketOverview'
import AIChat from './features/ai-chat/AIChat'
import { getRandomTheme, applyTheme } from './utils/colorThemes'

const useStyles = makeStyles({
  app: {
    minHeight: '100vh',
    backgroundColor: 'var(--bg-color)',
  },
  header: {
    backgroundColor: 'var(--bg-color)',
    color: 'var(--text-color)',
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXL}`,
    boxShadow: tokens.shadow4,
  },
  title: {
    color: 'var(--text-color)',
  },
  subtitle: {
    color: 'var(--text-color)',
    opacity: 0.9,
    marginTop: tokens.spacingVerticalXS,
  },
  nav: {
    backgroundColor: 'var(--bg-color)',
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    padding: `0 ${tokens.spacingHorizontalXL}`,
    '& button': {
      color: 'var(--text-color) !important',
    },
    '& svg': {
      color: 'var(--text-color) !important',
    },
  },
  content: {
    maxWidth: '1400px',
    margin: '0 auto',
  },
})

export default function App() {
  const styles = useStyles()
  const location = useLocation()
  const navigate = useNavigate()
  
  // Apply random theme on mount
  useEffect(() => {
    const theme = getRandomTheme()
    applyTheme(theme)
    console.log('Applied theme:', theme.name)
  }, [])
  const tabs = [
    { value: 'dashboard', label: 'Dashboard', icon: <Home24Regular />, path: '/dashboard', testId: 'tab-dashboard' },
    { value: 'tasks', label: 'Tasks', icon: <TaskListLtr24Regular />, path: '/tasks', testId: 'tab-tasks' },
    { value: 'overview', label: 'Übersicht', icon: <DocumentBulletList24Regular />, path: '/overview', testId: 'tab-overview' },
    { value: 'ai-chat', label: 'AI Chat', icon: <Bot24Regular />, path: '/ai-chat', testId: 'tab-ai-chat' },
    { value: 'about', label: 'About', icon: <Info24Regular />, path: '/about', testId: 'tab-about' },
  ]
  const activeTab = tabs.find((tab) => location.pathname.startsWith(tab.path))?.value ?? 'dashboard'

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <Subtitle1 className={styles.title}>Quart + React Demo Application</Subtitle1>
        <Text className={styles.subtitle} size={300}>
          A modern full-stack example with Python Quart backend and React + FluentUI frontend
        </Text>
      </header>

      <nav className={styles.nav}>
        <TabList
          selectedValue={activeTab}
          onTabSelect={(_, data) => {
            const selected = tabs.find((tab) => tab.value === data.value)
            if (selected) {
              navigate(selected.path)
            }
          }}
          size="large"
          style={{ color: 'yellow' }}
        >
          {tabs.map((tab) => (
            <Tab key={tab.value} value={tab.value} icon={tab.icon} data-testid={tab.testId} style={{ color: 'yellow' }}>
              {tab.label}
            </Tab>
          ))}
        </TabList>
      </nav>

      <main className={styles.content}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tasks" element={<TaskList />} />
          <Route path="/overview" element={<TicketOverview />} />
          <Route path="/ai-chat" element={<AIChat />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}
