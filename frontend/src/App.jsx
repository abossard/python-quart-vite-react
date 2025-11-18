/**
 * Main Application Component
 *
 * Demonstrates FluentUI Tab navigation and component composition
 * Following A Philosophy of Software Design:
 * - Deep modules: Each feature is self-contained
 * - Clear interfaces: Props and state flow is explicit
 */

import { useState } from 'react'
import {
  makeStyles,
  tokens,
  TabList,
  Tab,
  Text,
  Subtitle1,
} from '@fluentui/react-components'
import {
  Home24Regular,
  TaskListLtr24Regular,
  Info24Regular,
} from '@fluentui/react-icons'
import Dashboard from './features/dashboard/Dashboard'
import TaskList from './features/tasks/TaskList'
import About from './components/About'

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
  const [selectedTab, setSelectedTab] = useState('dashboard')

  // Render content based on selected tab (CALCULATION)
  const renderContent = () => {
    switch (selectedTab) {
      case 'dashboard':
        return <Dashboard />
      case 'tasks':
        return <TaskList />
      case 'about':
        return <About />
      default:
        return <Dashboard />
    }
  }

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
          selectedValue={selectedTab}
          onTabSelect={(_, data) => setSelectedTab(data.value)}
          size="large"
        >
          <Tab value="dashboard" icon={<Home24Regular />} data-testid="tab-dashboard">
            Dashboard
          </Tab>
          <Tab value="tasks" icon={<TaskListLtr24Regular />} data-testid="tab-tasks">
            Tasks
          </Tab>
          <Tab value="about" icon={<Info24Regular />} data-testid="tab-about">
            About
          </Tab>
        </TabList>
      </nav>

      <main className={styles.content}>{renderContent()}</main>
    </div>
  )
}
