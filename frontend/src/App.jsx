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
    Bot24Regular,
    DataHistogram24Regular,
    DocumentEdit24Regular,
    Info24Regular,
    Pulse24Regular,
    Settings24Regular,
    Table24Regular,
    Wrench24Regular,
} from '@fluentui/react-icons'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import AgentChat from './features/agent/AgentChat'
import ActivityPage from './features/activity/ActivityPage'
import CSVTicketTable from './features/csvtickets/CSVTicketTable'
import FieldsDocs from './features/fields/FieldsDocs'
import { USECASE_DEMO_DEFINITIONS } from './features/usecase-demo/demoDefinitions'
import UsecaseDemoPage from './features/usecase-demo/UsecaseDemoPage'
import KitchenSink from './features/kitchensink/KitchenSink'
import AgentRunPage from './features/workbench/AgentRunPage'
import KBADrafterPage from './features/kba-drafter/KBADrafterPage'
import WorkbenchPage from './features/workbench/WorkbenchPage'
import SettingsPage from './features/settings/SettingsPage'
import useTabPreferences from './features/settings/useTabPreferences'
import { listWorkbenchAgents } from './services/api'

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

  const [menuAgents, setMenuAgents] = useState([])
  useEffect(() => {
    listWorkbenchAgents()
      .then((data) => {
        const agents = (data.agents || []).filter((a) => a.show_in_menu)
        console.debug('[App] Menu agents:', agents.map((a) => a.name))
        setMenuAgents(agents)
      })
      .catch((err) => console.warn('[App] Failed to load menu agents:', err))
  }, [])

  const usecaseTabs = USECASE_DEMO_DEFINITIONS.filter(
    (definition) => definition.showInNav !== false
  ).map((definition) => ({
    value: definition.tabValue,
    label: definition.tabLabel,
    icon: <Bot24Regular />,
    defaultIconName: 'Bot24Regular',
    path: definition.route,
    testId: definition.tabTestId,
  }))

  const agentMenuTabs = menuAgents.map((agent) => ({
    value: `agent-menu-${agent.id}`,
    label: agent.name,
    icon: <Bot24Regular />,
    defaultIconName: 'Bot24Regular',
    path: `/agent-run/${agent.id}`,
    testId: `tab-agent-menu-${agent.id}`,
  }))

  // All tabs with defaultIconName for the settings page icon picker
  // Settings tab is excluded — it's always visible and pinned last
  const allTabs = useMemo(() => [
    { value: 'csvtickets', label: 'Tickets', icon: <Table24Regular />, defaultIconName: 'Table24Regular', path: '/csvtickets', testId: 'tab-csvtickets' },
    { value: 'kba-drafter', label: 'KBA Drafter', icon: <DocumentEdit24Regular />, defaultIconName: 'DocumentEdit24Regular', path: '/kba-drafter', testId: 'tab-kba-drafter' },
    ...usecaseTabs,
    ...agentMenuTabs,
    { value: 'kitchensink', label: 'Kitchen Sink', icon: <DataHistogram24Regular />, defaultIconName: 'DataHistogram24Regular', path: '/kitchensink', testId: 'tab-kitchensink' },
    { value: 'fields', label: 'Fields', icon: <Info24Regular />, defaultIconName: 'Info24Regular', path: '/fields', testId: 'tab-fields' },
    { value: 'workbench', label: 'Agent Fabric', icon: <Wrench24Regular />, defaultIconName: 'Wrench24Regular', path: '/workbench', testId: 'tab-workbench' },
    { value: 'agent', label: 'Agent', icon: <Bot24Regular />, defaultIconName: 'Bot24Regular', path: '/agent', testId: 'tab-agent' },
    { value: 'activity', label: 'Activity', icon: <Pulse24Regular />, defaultIconName: 'Pulse24Regular', path: '/activity', testId: 'tab-activity' },
  ], [usecaseTabs.length, agentMenuTabs.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const settingsTab = { value: 'settings', label: 'Settings', icon: <Settings24Regular />, defaultIconName: 'Settings24Regular', path: '/settings', testId: 'tab-settings' }

  const tabPrefs = useTabPreferences(allTabs)
  const { visibleTabs } = tabPrefs

  // Settings is always pinned last
  const navTabs = [...visibleTabs, settingsTab]

  const activeTab = navTabs.find((tab) => location.pathname.startsWith(tab.path))?.value
    ?? allTabs.find((tab) => location.pathname.startsWith(tab.path))?.value
    ?? 'csvtickets'

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <Subtitle1 className={styles.title}>CSV Ticket Viewer</Subtitle1>
        <Text className={styles.subtitle} size={300}>
          View and filter ticket data from CSV exports
        </Text>
      </header>

      <nav className={styles.nav}>
        <TabList
          selectedValue={activeTab}
          onTabSelect={(_, data) => {
            const selected = navTabs.find((tab) => tab.value === data.value)
            if (selected) {
              navigate(selected.path)
            }
          }}
          size="large"
        >
          {navTabs.map((tab) => (
            <Tab key={tab.value} value={tab.value} icon={tab.icon} data-testid={tab.testId}>
              {tab.label}
            </Tab>
          ))}
        </TabList>
      </nav>

      <main className={styles.content}>
        <Routes>
          <Route path="/" element={<Navigate to="/csvtickets" replace />} />
          <Route path="/kba-drafter" element={<KBADrafterPage />} />
          <Route path="/csvtickets" element={<CSVTicketTable />} />
          {USECASE_DEMO_DEFINITIONS.map((definition) => (
            <Route
              key={definition.id}
              path={definition.route}
              element={<UsecaseDemoPage definition={definition} />}
            />
          ))}
          <Route path="/kitchensink" element={<KitchenSink />} />
          <Route path="/fields" element={<FieldsDocs />} />
          <Route path="/workbench" element={<WorkbenchPage />} />
          {menuAgents.map((agent) => (
            <Route
              key={agent.id}
              path={`/agent-run/${agent.id}`}
              element={<AgentRunPage agent={agent} />}
            />
          ))}
          <Route path="/agent" element={<AgentChat />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/settings" element={<SettingsPage tabPrefs={tabPrefs} />} />
          <Route path="*" element={<Navigate to="/csvtickets" replace />} />
        </Routes>
      </main>
    </div>
  )
}
