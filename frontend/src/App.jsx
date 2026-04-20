/**
 * Main Application Component
 *
 * Demonstrates FluentUI Tab navigation and component composition
 * Following A Philosophy of Software Design:
 * - Deep modules: Each feature is self-contained
 * - Clear interfaces: Props and state flow is explicit
 */

import {
  Button,
    makeStyles,
  Subtitle2,
    Subtitle1,
    Text,
    tokens,
} from '@fluentui/react-components'
import {
    Bot24Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular,
    DataHistogram24Regular,
    DocumentEdit24Regular,
    Flow24Regular,
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
import WorkflowPage from './features/workflow/WorkflowPage'
import SettingsPage from './features/settings/SettingsPage'
import useTabPreferences from './features/settings/useTabPreferences'
import { listWorkbenchAgents } from './services/api'

const NAV_COLLAPSED_STORAGE_KEY = 'app-nav-collapsed'

const useStyles = makeStyles({
  app: {
    minHeight: '100vh',
    backgroundColor: tokens.colorNeutralBackground3,
    overflowX: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXL}`,
    boxShadow: tokens.shadow4,
    '@media (max-width: 768px)': {
      padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    },
    '@media (max-width: 480px)': {
      padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    },
  },
  headerInner: {
    maxWidth: '1400px',
    margin: '0 auto',
  },
  title: {
    color: tokens.colorNeutralForegroundOnBrand,
    overflowWrap: 'anywhere',
  },
  subtitle: {
    color: tokens.colorNeutralForegroundOnBrand,
    opacity: 0.9,
    marginTop: tokens.spacingVerticalXS,
    overflowWrap: 'anywhere',
  },
  shell: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
  },
  sidebar: {
    width: '280px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
    transitionDuration: tokens.durationNormal,
    transitionProperty: 'width',
    transitionTimingFunction: tokens.curveEasyEase,
    minHeight: 0,
    '@media (max-width: 768px)': {
      width: '232px',
    },
  },
  sidebarCollapsed: {
    width: '88px',
    '@media (max-width: 768px)': {
      width: '72px',
    },
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  sidebarTitle: {
    minWidth: 0,
    overflow: 'hidden',
  },
  collapseButton: {
    minWidth: '36px',
    width: '36px',
    height: '36px',
    padding: 0,
    flexShrink: 0,
  },
  navList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingHorizontalS,
    overflowY: 'auto',
    flex: 1,
    minHeight: 0,
  },
  navButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    border: 'none',
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: 'transparent',
    color: tokens.colorNeutralForeground2,
    cursor: 'pointer',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    textAlign: 'left',
    transitionDuration: tokens.durationNormal,
    transitionProperty: 'background-color, color',
    transitionTimingFunction: tokens.curveEasyEase,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      color: tokens.colorNeutralForeground1,
    },
  },
  navButtonCollapsed: {
    justifyContent: 'center',
    padding: `${tokens.spacingVerticalS} 0`,
  },
  navButtonActive: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    boxShadow: `inset 3px 0 0 ${tokens.colorBrandStroke1}`,
    ':hover': {
      backgroundColor: tokens.colorBrandBackground2Hover,
      color: tokens.colorBrandForeground1,
    },
  },
  navIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  navLabelWrap: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  navLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  navPath: {
    color: tokens.colorNeutralForeground4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  contentArea: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    width: '100%',
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXL}`,
    '@media (max-width: 768px)': {
      padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    },
    '@media (max-width: 480px)': {
      padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    },
  },
  contentInner: {
    width: '100%',
    maxWidth: '1400px',
    margin: '0 auto',
  },
})

export default function App() {
  const styles = useStyles()
  const location = useLocation()
  const navigate = useNavigate()
  const [isNavCollapsed, setIsNavCollapsed] = useState(false)

  const [menuAgents, setMenuAgents] = useState([])
  useEffect(() => {
    const storedValue = window.localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY)
    if (storedValue !== null) {
      setIsNavCollapsed(storedValue === 'true')
      return
    }
    if (window.innerWidth <= 1024) {
      setIsNavCollapsed(true)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(NAV_COLLAPSED_STORAGE_KEY, String(isNavCollapsed))
  }, [isNavCollapsed])

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
    { value: 'workflow', label: 'Support Workflow', icon: <Flow24Regular />, defaultIconName: 'Flow24Regular', path: '/workflow', testId: 'tab-workflow' },
  ], [usecaseTabs.length, agentMenuTabs.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const settingsTab = { value: 'settings', label: 'Settings', icon: <Settings24Regular />, defaultIconName: 'Settings24Regular', path: '/settings', testId: 'tab-settings' }

  const tabPrefs = useTabPreferences(allTabs)
  const { visibleTabs } = tabPrefs

  // Settings is always pinned last
  const navTabs = [...visibleTabs, settingsTab]

  const activeTab = navTabs.find((tab) => location.pathname.startsWith(tab.path))?.value
    ?? allTabs.find((tab) => location.pathname.startsWith(tab.path))?.value
    ?? 'csvtickets'

  const mainNavTabs = navTabs.filter((tab) => tab.value !== 'settings')

  const renderNavButton = (tab) => {
    const isActive = activeTab === tab.value
    return (
      <button
        key={tab.value}
        type="button"
        className={`${styles.navButton} ${isNavCollapsed ? styles.navButtonCollapsed : ''} ${isActive ? styles.navButtonActive : ''}`}
        onClick={() => navigate(tab.path)}
        data-testid={tab.testId}
        aria-label={tab.label}
        title={isNavCollapsed ? tab.label : undefined}
      >
        <span className={styles.navIcon}>{tab.icon}</span>
        {!isNavCollapsed && (
          <span className={styles.navLabelWrap}>
            <Text className={styles.navLabel} weight={isActive ? 'semibold' : 'regular'}>
              {tab.label}
            </Text>
            <Text className={styles.navPath} size={200}>
              {tab.path}
            </Text>
          </span>
        )}
      </button>
    )
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Subtitle1 className={styles.title}>CSV Ticket Viewer</Subtitle1>
          <Text className={styles.subtitle} size={300}>
            View and filter ticket data from CSV exports
          </Text>
        </div>
      </header>

      <div className={styles.shell}>
        <aside className={`${styles.sidebar} ${isNavCollapsed ? styles.sidebarCollapsed : ''}`}>
          <div className={styles.sidebarHeader}>
            {!isNavCollapsed && (
              <div className={styles.sidebarTitle}>
                <Subtitle2>Navigation</Subtitle2>
                <Text size={200}>Main sections</Text>
              </div>
            )}
            <Button
              className={styles.collapseButton}
              appearance="subtle"
              icon={isNavCollapsed ? <ChevronRight24Regular /> : <ChevronLeft24Regular />}
              onClick={() => setIsNavCollapsed((current) => !current)}
              aria-label={isNavCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              title={isNavCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            />
          </div>

          <nav className={styles.navList} aria-label="Main navigation">
            {mainNavTabs.map(renderNavButton)}
            {renderNavButton(settingsTab)}
          </nav>
        </aside>

        <div className={styles.contentArea}>
          <main className={styles.content}>
            <div className={styles.contentInner}>
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
                <Route path="/workflow" element={<WorkflowPage />} />
                <Route path="/settings" element={<SettingsPage tabPrefs={tabPrefs} />} />
                <Route path="*" element={<Navigate to="/csvtickets" replace />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
