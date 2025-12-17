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
  Subtitle1,
  Tab,
  TabList,
  Text,
  tokens,
} from '@fluentui/react-components'
import {
  AlertUrgent24Regular,
  Bot24Regular,
  Home24Regular,
  Info24Regular,
  PersonQuestionMark24Regular,
  TaskListLtr24Regular,
} from '@fluentui/react-icons'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import About from './components/About'
import AgentChat from './features/agent/AgentChat'
import Dashboard from './features/dashboard/Dashboard'
import TaskList from './features/tasks/TaskList'
import TicketList from './features/tickets/TicketList'
import TicketsWithoutAnAssignee from './features/tickets/TicketsWithoutAnAssignee'

const useStyles = makeStyles({
  app: {
    minHeight: '100vh',
    backgroundColor: tokens.colorNeutralBackground3,
  },
  header: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXL}`,
    boxShadow: tokens.shadow4,
  },
  title: {
    color: tokens.colorNeutralForegroundOnBrand,
  },
  subtitle: {
    color: tokens.colorNeutralForegroundOnBrand,
    opacity: 0.9,
    marginTop: tokens.spacingVerticalXS,
  },
  nav: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    padding: `0 ${tokens.spacingHorizontalXL}`,
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
  const tabs = [
    { value: 'dashboard', label: 'Dashboard', icon: <Home24Regular />, path: '/dashboard', testId: 'tab-dashboard' },
    { value: 'tasks', label: 'Tasks', icon: <TaskListLtr24Regular />, path: '/tasks', testId: 'tab-tasks' },
    { value: 'tickets', label: 'Tickets', icon: <AlertUrgent24Regular />, path: '/tickets', testId: 'tab-tickets' },
    { value: 'unassigned', label: 'Unassigned', icon: <PersonQuestionMark24Regular />, path: '/unassigned', testId: 'tab-unassigned' },
    { value: 'agent', label: 'AI Agent', icon: <Bot24Regular />, path: '/agent', testId: 'tab-agent' },
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
        >
          {tabs.map((tab) => (
            <Tab key={tab.value} value={tab.value} icon={tab.icon} data-testid={tab.testId}>
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
          <Route path="/tickets" element={<TicketList />} />
          <Route path="/unassigned" element={<TicketsWithoutAnAssignee />} />
          <Route path="/agent" element={<AgentChat />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}
