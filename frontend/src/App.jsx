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
    Info24Regular,
    Table24Regular,
} from '@fluentui/react-icons'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import AgentChat from './features/agent/AgentChat'
import CSVTicketTable from './features/csvtickets/CSVTicketTable'
import FieldsDocs from './features/fields/FieldsDocs'
import { USECASE_DEMO_DEFINITIONS } from './features/usecase-demo/demoDefinitions'
import UsecaseDemoPage from './features/usecase-demo/UsecaseDemoPage'
import KitchenSink from './features/kitchensink/KitchenSink'

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

  const usecaseTabs = USECASE_DEMO_DEFINITIONS.filter(
    (definition) => definition.showInNav !== false
  ).map((definition) => ({
    value: definition.tabValue,
    label: definition.tabLabel,
    icon: <Bot24Regular />,
    path: definition.route,
    testId: definition.tabTestId,
  }))

  const tabs = [
    { value: 'csvtickets', label: 'Tickets', icon: <Table24Regular />, path: '/csvtickets', testId: 'tab-csvtickets' },
    ...usecaseTabs,
    { value: 'kitchensink', label: 'Kitchen Sink', icon: <DataHistogram24Regular />, path: '/kitchensink', testId: 'tab-kitchensink' },
    { value: 'fields', label: 'Fields', icon: <Info24Regular />, path: '/fields', testId: 'tab-fields' },
    { value: 'agent', label: 'Agent', icon: <Bot24Regular />, path: '/agent', testId: 'tab-agent' },
  ]
  const activeTab = tabs.find((tab) => location.pathname.startsWith(tab.path))?.value ?? 'csvtickets'

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
          <Route path="/" element={<Navigate to="/csvtickets" replace />} />
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
          <Route path="/agent" element={<AgentChat />} />
          <Route path="*" element={<Navigate to="/csvtickets" replace />} />
        </Routes>
      </main>
    </div>
  )
}
