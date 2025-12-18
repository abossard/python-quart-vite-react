import { useState, useEffect } from 'react';
import {
  makeStyles,
  shorthands,
  tokens,
  Button,
  Checkbox,
  Dropdown,
  Option,
  Switch,
  Label,
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Field,
  Textarea,
} from '@fluentui/react-components';
import {
  ChevronDown20Regular,
  ChevronRight20Regular,
  Checkmark20Regular,
  SplitVertical20Regular,
  WeatherSunny20Regular,
  WeatherMoon20Regular,
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    minHeight: '100vh',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  
  // Top Filter Bar
  filterBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: '56px',
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.padding('0', '24px'),
    ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2),
  },
  filterControls: {
    display: 'flex',
    ...shorthands.gap('12px'),
    alignItems: 'center',
  },
  filterActions: {
    display: 'flex',
    ...shorthands.gap('8px'),
  },
  
  // Ticket Scope Selector
  scopeBar: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.padding('12px', '24px'),
    ...shorthands.gap('12px'),
    ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2),
  },
  
  // Content Area
  content: {
    ...shorthands.padding('24px'),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('24px'),
  },
  
  // Section
  section: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.overflow('hidden'),
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
    ...shorthands.padding('16px', '24px'),
    cursor: 'pointer',
    userSelect: 'none',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  sectionHeaderPrimary: {
    ...shorthands.borderBottom('2px', 'solid', '#D97706'),
  },
  sectionHeaderSecondary: {
    ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2),
  },
  sectionTitle: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  
  // Ticket Row
  ticketRow: {
    display: 'grid',
    gridTemplateColumns: '40px 120px 1fr auto',
    alignItems: 'center',
    ...shorthands.padding('12px', '24px'),
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke2),
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  ticketRowSimple: {
    gridTemplateColumns: '40px 120px 1fr',
  },
  ticketId: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorBrandForeground1,
    fontFamily: tokens.fontFamilyMonospace,
    cursor: 'pointer',
    ':hover': {
      textDecoration: 'underline',
    },
  },
  ticketDescription: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    whiteSpace: 'nowrap',
    ...shorthands.overflow('hidden'),
    textOverflow: 'ellipsis',
  },
  ticketActions: {
    display: 'flex',
    ...shorthands.gap('8px'),
    justifyContent: 'flex-end',
  },
  
  // Empty State
  emptyState: {
    ...shorthands.padding('48px', '24px'),
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },

  // Dialog Styles
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('16px'),
  },
  ticketIdBadge: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorBrandForeground1,
    fontFamily: tokens.fontFamilyMonospace,
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.padding('4px', '8px'),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
  worklogEntry: {
    ...shorthands.padding('8px'),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    marginBottom: '8px',
  },
  worklogTimestamp: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
  },
  worklogUser: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
  },
  worklogText: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    marginTop: '4px',
  },
});

export default function TicketOverview({ isDarkMode: externalDarkMode, onThemeChange }) {
  const styles = useStyles();
  const [ticketScope, setTicketScope] = useState('my-tickets');
  const [selectedGroups, setSelectedGroups] = useState(['OFC']);
  const [assignedTo, setAssignedTo] = useState('noah-huber');
  const [isDarkMode, setIsDarkMode] = useState(externalDarkMode || false);
  const [expandedSections, setExpandedSections] = useState({
    multiIssue: true,
    oneIssue: true,
  });
  const [selectedTickets, setSelectedTickets] = useState(new Set());
  const [tickets, setTickets] = useState({
    multiIssue: [],
    oneIssue: [],
  });
  const [selectedTicketDetails, setSelectedTicketDetails] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    // Load tickets from API immediately
    loadTickets();
    
    // Set up polling every 10 seconds
    const interval = setInterval(() => {
      loadTickets();
    }, 10000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [ticketScope, selectedGroups, assignedTo]);

  const fetchExternalTickets = async () => {
    try {
      const response = await fetch('https://faux-feed-flare.lovable.app/a7f2b8c4-d3e9-4f1a-b5c6-e8d9f0123456');
      if (!response.ok) {
        console.error('Failed to fetch tickets:', response.status);
        return [];
      }
      const data = await response.json();
      return data.tickets || data || [];
    } catch (error) {
      console.error('Error fetching external tickets:', error);
      return [];
    }
  };

  const detectMultipleIssues = (description) => {
    if (!description) return false;
    
    // Keywords that indicate separate issues
    const keywords = ['VPN', 'Drucker', 'Printer', 'SW-Center', 'Software', 'Natel', 'Phone', 
                      'SAP', 'Edge', 'écran', 'Screen', 'souris', 'Mouse'];
    
    const foundKeywords = keywords.filter(keyword => 
      description.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // If 2 or more different issue types are mentioned, it's multi-issue
    return foundKeywords.length >= 2;
  };

  const countIssues = (description) => {
    if (!description) return 1;
    
    const keywords = ['VPN', 'Drucker', 'Printer', 'SW-Center', 'Software', 'Natel', 'Phone', 
                      'SAP', 'Edge', 'écran', 'Screen', 'souris', 'Mouse'];
    
    const foundKeywords = keywords.filter(keyword => 
      description.toLowerCase().includes(keyword.toLowerCase())
    );
    
    return Math.max(foundKeywords.length, 1);
  };

  const loadTickets = async () => {
    // Fetch tickets from external API
    const externalTickets = await fetchExternalTickets();
    
    // Transform external tickets to our format
    const transformedTickets = externalTickets.map(ticket => ({
      id: ticket.id || ticket.ticketId || `INC${Math.random().toString(36).substr(2, 9)}`,
      title: ticket.title || ticket.summary || 'Untitled Ticket',
      description: ticket.description || ticket.details || '',
      assignedTo: ticket.assignedTo || ticket.assignee || 'Unassigned',
      service: ticket.service || ticket.category || 'General Support',
      issueCount: ticket.issueCount || countIssues(ticket.description || ticket.details || ''),
      worklog: ticket.worklog || [
        { 
          timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '), 
          user: 'System', 
          entry: 'Ticket imported from external system' 
        }
      ],
    }));

    // Combine with mock data
    const mockTickets = {
      multiIssue: [
        {
          id: 'INC0001',
          title: 'Multiple IT Issues - Urgent',
          description: 'VPN geht nicht, Drucker kaputt, SW-Center leer, Natel spinnt',
          issueCount: 4,
          assignedTo: 'Noah Huber',
          service: 'IT Support',
          worklog: [
            { timestamp: '2025-12-17 09:15', user: 'Noah Huber', entry: 'Ticket created by user' },
            { timestamp: '2025-12-17 09:30', user: 'Sarah Müller', entry: 'Ticket assigned to IT Support team' },
            { timestamp: '2025-12-17 10:00', user: 'Thomas Schmidt', entry: 'Investigation started - checking VPN logs' },
          ],
        },
        {
          id: 'INC0002',
          title: 'Problèmes multiples informatiques',
          description: 'Problèmes multiples : Edge, VPN, écran, souris',
          issueCount: 4,
          assignedTo: 'Sarah Müller',
          service: 'IT Support',
          worklog: [
            { timestamp: '2025-12-17 08:45', user: 'Anna Weber', entry: 'Reported via phone' },
            { timestamp: '2025-12-17 09:00', user: 'Michael Fischer', entry: 'Assigned to desktop support' },
          ],
        },
        {
          id: 'INC0003',
          title: 'SAP and Printer Issues',
          description: 'SAP GUI, Drucker, Natel geht nicht',
          issueCount: 3,
          assignedTo: 'Thomas Schmidt',
          service: 'Application Support',
          worklog: [
            { timestamp: '2025-12-17 10:30', user: 'Noah Huber', entry: 'User reported multiple issues' },
            { timestamp: '2025-12-17 11:00', user: 'Sarah Müller', entry: 'SAP team notified' },
          ],
        },
      ],
      oneIssue: [
        {
          id: 'INC0101',
          title: 'VPN Connection Failed',
          description: 'VPN Connection Error 720',
          assignedTo: 'Noah Huber',
          service: 'Network Services',
          worklog: [
            { timestamp: '2025-12-17 08:00', user: 'Noah Huber', entry: 'User unable to connect to VPN' },
            { timestamp: '2025-12-17 08:15', user: 'Thomas Schmidt', entry: 'Checking network credentials' },
            { timestamp: '2025-12-17 08:30', user: 'Thomas Schmidt', entry: 'Reset VPN profile - testing in progress' },
          ],
        },
        {
          id: 'INC0102',
          title: 'Printer Toner Error',
          description: 'Printer Toner Error - HP LaserJet 400 M401dn Office 3.01',
          assignedTo: 'Anna Weber',
          service: 'Facilities',
          worklog: [
            { timestamp: '2025-12-17 09:00', user: 'Anna Weber', entry: 'Printer showing toner error' },
            { timestamp: '2025-12-17 09:20', user: 'Michael Fischer', entry: 'Ordered replacement toner cartridge' },
          ],
        },
        {
          id: 'INC0103',
          title: 'Software Center Empty',
          description: 'Software Center Not Showing Applications',
          assignedTo: 'Noah Huber',
          service: 'IT Support',
          worklog: [
            { timestamp: '2025-12-17 10:00', user: 'Sarah Müller', entry: 'Software Center appears empty' },
            { timestamp: '2025-12-17 10:15', user: 'Noah Huber', entry: 'Resyncing SCCM catalog' },
          ],
        },
        {
          id: 'INC0104',
          title: 'Mobile Phone Battery Issue',
          description: 'Mobile Phone Battery Draining Quickly',
          assignedTo: 'Michael Fischer',
          service: 'Mobile Support',
          worklog: [
            { timestamp: '2025-12-17 11:00', user: 'Thomas Schmidt', entry: 'Battery draining within 2 hours' },
            { timestamp: '2025-12-17 11:20', user: 'Anna Weber', entry: 'Checking background app activity' },
          ],
        },
      ],
    };

    // Merge external tickets with mock data
    const allExternalMultiIssue = transformedTickets.filter(t => detectMultipleIssues(t.description));
    const allExternalOneIssue = transformedTickets.filter(t => !detectMultipleIssues(t.description));
    
    const allTickets = {
      multiIssue: [...mockTickets.multiIssue, ...allExternalMultiIssue],
      oneIssue: [...mockTickets.oneIssue, ...allExternalOneIssue],
    };

    // Update last refresh time
    setLastUpdate(new Date().toLocaleTimeString());

    // Filter tickets based on assignedTo selection
    const getAssigneeName = (assignedToValue) => {
      const mapping = {
        'noah-huber': 'Noah Huber',
        'sarah-mueller': 'Sarah Müller',
        'thomas-schmidt': 'Thomas Schmidt',
        'anna-weber': 'Anna Weber',
        'michael-fischer': 'Michael Fischer',
        'all': null, // Show all tickets
      };
      return mapping[assignedToValue];
    };

    const assigneeName = getAssigneeName(assignedTo);
    
    const filteredTickets = {
      multiIssue: assigneeName 
        ? allTickets.multiIssue.filter(ticket => ticket.assignedTo === assigneeName)
        : allTickets.multiIssue,
      oneIssue: assigneeName
        ? allTickets.oneIssue.filter(ticket => ticket.assignedTo === assigneeName)
        : allTickets.oneIssue,
    };

    setTickets(filteredTickets);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleTicketSelection = (ticketId) => {
    setSelectedTickets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId);
      } else {
        newSet.add(ticketId);
      }
      return newSet;
    });
  };

  const handleCheck = (ticketId) => {
    // Find ticket in either multiIssue or oneIssue array
    const ticket = tickets.multiIssue.find(t => t.id === ticketId) || 
                   tickets.oneIssue.find(t => t.id === ticketId);
    if (ticket) {
      setSelectedTicketDetails(ticket);
      setIsDialogOpen(true);
    }
  };

  const handleSplit = (ticketId) => {
    console.log('Split ticket:', ticketId);
    // TODO: Implement ticket splitting
  };

  const handleApplyFilters = () => {
    loadTickets();
  };

  const handleResetFilters = () => {
    setSelectedGroups(['OFC']);
    setTicketScope('my-tickets');
    setAssignedTo('noah-huber');
  };

  return (
    <FluentProvider theme={isDarkMode ? webDarkTheme : webLightTheme}>
      <div className={styles.container}>
        {/* Top Filter Bar */}
        <div className={styles.filterBar}>
          <div className={styles.filterControls}>
            <Label>Filters:</Label>
            <Dropdown
            placeholder="Status"
            size="small"
          >
            <Option>All</Option>
            <Option>New</Option>
            <Option>In Progress</Option>
            <Option>Pending</Option>
          </Dropdown>
          <Dropdown
            placeholder="Priority"
            size="small"
          >
            <Option>All</Option>
            <Option>Critical</Option>
            <Option>High</Option>
            <Option>Medium</Option>
            <Option>Low</Option>
          </Dropdown>
        </div>
        <div className={styles.filterActions}>
          <Button appearance="primary" size="small" onClick={handleApplyFilters}>
            Apply
          </Button>
          <Button appearance="subtle" size="small" onClick={handleResetFilters}>
            Reset
          </Button>
        </div>
      </div>

      {/* Ticket Scope Selector & Group Selection */}
      <div className={styles.scopeBar}>
        <Label>Ticket Scope:</Label>
        <Dropdown
          value={ticketScope}
          selectedOptions={[ticketScope]}
          onOptionSelect={(_, data) => setTicketScope(data.optionValue)}
          size="small"
        >
          <Option value="my-tickets">My Tickets</Option>
          <Option value="group-tickets">Group Tickets</Option>
        </Dropdown>
        
        <Label style={{ marginLeft: '24px' }}>Assigned Group:</Label>
        <Dropdown
          value={selectedGroups[0]}
          selectedOptions={selectedGroups}
          onOptionSelect={(_, data) => setSelectedGroups([data.optionValue])}
          size="small"
        >
          <Option value="OFC">OFC</Option>
          <Option value="WOS">WOS</Option>
          <Option value="NET">NET</Option>
          <Option value="SEC">SEC</Option>
          <Option value="SDE">SDE</Option>
        </Dropdown>
        
        <Label style={{ marginLeft: '24px' }}>Assigned to:</Label>
        <Dropdown
          value={assignedTo}
          selectedOptions={[assignedTo]}
          onOptionSelect={(_, data) => setAssignedTo(data.optionValue)}
          size="small"
        >
          <Option value="noah-huber">Noah Huber</Option>
          <Option value="sarah-mueller">Sarah Müller</Option>
          <Option value="thomas-schmidt">Thomas Schmidt</Option>
          <Option value="anna-weber">Anna Weber</Option>
          <Option value="michael-fischer">Michael Fischer</Option>
          <Option value="all">All Personnel</Option>
        </Dropdown>
        
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
          {lastUpdate && (
            <Label size="small" style={{ color: tokens.colorNeutralForeground3 }}>
              Last update: {lastUpdate}
            </Label>
          )}
          <Switch
            checked={isDarkMode}
            onChange={(_, data) => {
              setIsDarkMode(data.checked);
              if (onThemeChange) onThemeChange(data.checked);
            }}
            label={isDarkMode ? <WeatherMoon20Regular /> : <WeatherSunny20Regular />}
          />
        </div>
      </div>

      {/* Content Area */}
      <div className={styles.content}>
        {/* Multi-Issue Tickets (Primary Section) */}
        <div className={styles.section}>
          <div
            className={`${styles.sectionHeader} ${styles.sectionHeaderPrimary}`}
            onClick={() => toggleSection('multiIssue')}
          >
            {expandedSections.multiIssue ? (
              <ChevronDown20Regular />
            ) : (
              <ChevronRight20Regular />
            )}
            <span className={styles.sectionTitle}>
              Multi-Issue Tickets ({tickets.multiIssue.length})
            </span>
          </div>
          {expandedSections.multiIssue && (
            <>
              {tickets.multiIssue.length === 0 ? (
                <div className={styles.emptyState}>
                  No multi-issue tickets found
                </div>
              ) : (
                tickets.multiIssue.map((ticket) => (
                  <div key={ticket.id} className={styles.ticketRow}>
                    <Checkbox
                      checked={selectedTickets.has(ticket.id)}
                      onChange={() => toggleTicketSelection(ticket.id)}
                    />
                    <span 
                      className={styles.ticketId}
                      onClick={() => handleCheck(ticket.id)}
                    >
                      {ticket.id}
                    </span>
                    <span className={styles.ticketDescription}>
                      {ticket.description}
                    </span>
                    <div className={styles.ticketActions}>
                      <Button
                        appearance="subtle"
                        size="small"
                        icon={<Checkmark20Regular />}
                        onClick={() => handleCheck(ticket.id)}
                      >
                        Check
                      </Button>
                      <Button
                        appearance="subtle"
                        size="small"
                        icon={<SplitVertical20Regular />}
                        onClick={() => handleSplit(ticket.id)}
                        style={{ color: '#D97706' }}
                      >
                        Split
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        {/* One-Issue Tickets (Secondary Section) */}
        <div className={styles.section}>
          <div
            className={`${styles.sectionHeader} ${styles.sectionHeaderSecondary}`}
            onClick={() => toggleSection('oneIssue')}
          >
            {expandedSections.oneIssue ? (
              <ChevronDown20Regular />
            ) : (
              <ChevronRight20Regular />
            )}
            <span className={styles.sectionTitle}>
              One-Issue Tickets ({tickets.oneIssue.length})
            </span>
          </div>
          {expandedSections.oneIssue && (
            <>
              {tickets.oneIssue.length === 0 ? (
                <div className={styles.emptyState}>
                  No one-issue tickets found
                </div>
              ) : (
                tickets.oneIssue.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`${styles.ticketRow} ${styles.ticketRowSimple}`}
                  >
                    <Checkbox
                      checked={selectedTickets.has(ticket.id)}
                      onChange={() => toggleTicketSelection(ticket.id)}
                    />
                    <span 
                      className={styles.ticketId}
                      onClick={() => handleCheck(ticket.id)}
                    >
                      {ticket.id}
                    </span>
                    <span className={styles.ticketDescription}>
                      {ticket.description}
                    </span>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>

    {/* Ticket Details Dialog */}
    <Dialog open={isDialogOpen} onOpenChange={(e, data) => setIsDialogOpen(data.open)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>
            Ticket Details
          </DialogTitle>
          <DialogContent className={styles.dialogContent}>
            {selectedTicketDetails && (
              <>
                <Field label="Ticket ID">
                  <span className={styles.ticketIdBadge}>{selectedTicketDetails.id}</span>
                </Field>
                
                <Field label="Title">
                  <Label weight="regular">{selectedTicketDetails.title}</Label>
                </Field>

                <Field label="Description">
                  <Textarea
                    value={selectedTicketDetails.description}
                    readOnly
                    resize="vertical"
                    rows={3}
                  />
                </Field>

                <Field label="Assigned To">
                  <Label weight="regular">{selectedTicketDetails.assignedTo}</Label>
                </Field>

                <Field label="Service">
                  <Label weight="regular">{selectedTicketDetails.service}</Label>
                </Field>

                {selectedTicketDetails.issueCount && (
                  <Field label="Issue Count">
                    <Label weight="regular">{selectedTicketDetails.issueCount} issues detected</Label>
                  </Field>
                )}

                <Field label="Worklog">
                  <div>
                    {selectedTicketDetails.worklog && selectedTicketDetails.worklog.map((entry, index) => (
                      <div key={index} className={styles.worklogEntry}>
                        <div className={styles.worklogTimestamp}>{entry.timestamp}</div>
                        <div className={styles.worklogUser}>{entry.user}</div>
                        <div className={styles.worklogText}>{entry.entry}</div>
                      </div>
                    ))}
                  </div>
                </Field>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={() => setIsDialogOpen(false)}>
              Close
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
    </FluentProvider>
  );
}
