import { useState } from 'react';
import {
  makeStyles,
  Tab,
  TabList,
  tokens,
  FluentProvider,
  webLightTheme,
  webDarkTheme,
} from '@fluentui/react-components';
import {
  GridDots24Regular,
  Bot24Regular,
} from '@fluentui/react-icons';
import TicketOverview from './TicketOverview';
import AgentChat from './features/agent/AgentChat';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    minHeight: '100vh',
  },
  nav: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    padding: '0 24px',
  },
  content: {
    flex: 1,
    width: '100%',
  },
});

export default function TicketConsole() {
  const styles = useStyles();
  const [activeTab, setActiveTab] = useState('overview');
  const [isDarkMode, setIsDarkMode] = useState(false);

  return (
    <FluentProvider theme={isDarkMode ? webDarkTheme : webLightTheme}>
      <div className={styles.container}>
        <nav className={styles.nav}>
          <TabList
            selectedValue={activeTab}
            onTabSelect={(_, data) => setActiveTab(data.value)}
            size="large"
          >
            <Tab value="overview" icon={<GridDots24Regular />}>
              Ticket Overview
            </Tab>
            <Tab value="agent" icon={<Bot24Regular />}>
              AI Agent
            </Tab>
          </TabList>
        </nav>

        <div className={styles.content}>
          {activeTab === 'overview' && <TicketOverview isDarkMode={isDarkMode} onThemeChange={setIsDarkMode} />}
          {activeTab === 'agent' && <AgentChat />}
        </div>
      </div>
    </FluentProvider>
  );
}
