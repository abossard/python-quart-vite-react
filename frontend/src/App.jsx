/**
 * Main Application Component
 *
 * Demonstrates FluentUI Tab navigation and component composition
 * Following A Philosophy of Software Design:
 * - Deep modules: Each feature is self-contained
 * - Clear interfaces: Props and state flow is explicit
 */

import { useState, useEffect } from 'react'
import {
  Button,
  Dropdown,
  Input,
  Label,
  makeStyles,
  Option,
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
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  logoPlaceholder: {
    width: '100%',
    height: '2.5cm',
    backgroundColor: tokens.colorNeutralBackground4,
    border: `2px dashed ${tokens.colorNeutralStroke2}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.borderRadiusMedium,
    color: tokens.colorNeutralForeground3,
    fontSize: '12px',
    textAlign: 'center',
    padding: tokens.spacingHorizontalM,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  welcomeText: {
    width: '100%',
    height: '1cm',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px dashed ${tokens.colorNeutralStroke2}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    fontSize: '14px',
    color: tokens.colorNeutralForeground3,
    position: 'absolute',
    top: '2.5cm',
    left: 0,
  },
  slotsBar: {
    width: '100%',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px dashed ${tokens.colorNeutralStroke2}`,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    fontSize: '14px',
    color: tokens.colorNeutralForeground3,
    position: 'absolute',
    top: '5.5cm',
    left: 0,
  },
  slotsTextContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
  calendarInput: {
    width: '180px',
  },
  slotsDisplay: {
    width: '100%',
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    position: 'absolute',
    top: '7cm',
    left: 0,
    maxHeight: '15cm',
    overflowY: 'auto',
  },
  slotsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: tokens.spacingVerticalS,
    marginTop: tokens.spacingVerticalS,
  },
  slotButton: {
    minWidth: '100px',
  },
  bookingFormContainer: {
    width: '100%',
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `2px solid ${tokens.colorBrandBackground}`,
    borderRadius: tokens.borderRadiusMedium,
    marginTop: tokens.spacingVerticalM,
  },
  formField: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    marginBottom: tokens.spacingVerticalM,
  },
  spacer: {
    flexGrow: 1,
  },
  contentWrapper: {
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    boxShadow: tokens.shadow4,
  },
  title: {
    color: tokens.colorNeutralForegroundOnBrand,
    fontSize: '16px',
  },
  subtitle: {
    color: tokens.colorNeutralForegroundOnBrand,
    opacity: 0.9,
    marginTop: tokens.spacingVerticalXXS,
    fontSize: '12px',
  },
  nav: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    padding: `0 ${tokens.spacingHorizontalM}`,
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
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [bookingType, setBookingType] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    vorname: '',
    email: '',
    hardware: '',
    userEmail: '',
  })
  
  // Reset form data when slot or bookingType changes
  useEffect(() => {
    setFormData({
      name: '',
      vorname: '',
      email: '',
      hardware: '',
      userEmail: '',
    })
  }, [selectedSlot, bookingType])
  
  const formatDateSwiss = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}.${month}.${year}`
  }
  
  const generateTimeSlots = () => {
    const slots = []
    for (let hour = 8; hour <= 16; hour++) {
      for (let minute = 0; minute < 60; minute += 20) {
        // Stoppe bei 16:20
        if (hour === 16 && minute > 20) break
        
        const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
        slots.push(time)
      }
    }
    return slots
  }
  
  const tabs = [
    { value: 'dashboard', label: 'Dashboard', icon: <Home24Regular />, path: '/dashboard', testId: 'tab-dashboard' },
    { value: 'tasks', label: 'Tasks', icon: <TaskListLtr24Regular />, path: '/tasks', testId: 'tab-tasks' },
    { value: 'tickets', label: 'Tickets', icon: <AlertUrgent24Regular />, path: '/tickets', testId: 'tab-tickets' },
    { value: 'unassigned', label: 'Unassigned', icon: <PersonQuestionMark24Regular />, path: '/unassigned', testId: 'tab-unassigned' },
  ]
  const activeTab = tabs.find((tab) => location.pathname.startsWith(tab.path))?.value ?? 'dashboard'

  return (
    <div className={styles.app}>
      <div className={styles.logoPlaceholder}>
        BIT Logo
        <br />
        (2.5cm)
      </div>
      <div className={styles.welcomeText}>
        BIT-Store Zollikofen
      </div>
      <div className={styles.slotsBar}>
        <div className={styles.slotsTextContainer}>
          <div>Verfügbare Slots</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>Datum</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="date"
            className={styles.calendarInput}
            value={selectedDate || ''}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: '6px 8px',
              borderRadius: tokens.borderRadiusMedium,
              border: `1px solid ${tokens.colorNeutralStroke1}`,
              fontSize: '13px',
            }}
          />
          {selectedDate && (
            <Text style={{ fontSize: '13px', color: tokens.colorNeutralForeground2 }}>
              {formatDateSwiss(selectedDate)}
            </Text>
          )}
        </div>
      </div>
      
      {selectedDate && (
        <div className={styles.slotsDisplay}>
          <Text weight="semibold">Verfügbare Termine am {formatDateSwiss(selectedDate)}</Text>
          <div className={styles.slotsGrid}>
            {generateTimeSlots().map((slot) => (
              <Button
                key={slot}
                appearance={selectedSlot === slot ? "primary" : "outline"}
                size="small"
                className={styles.slotButton}
                onClick={slot === '08:00' ? () => setSelectedSlot(slot) : undefined}
              >
                {slot}
              </Button>
            ))}
          </div>
          
          {selectedSlot === '08:00' && (
            <div className={styles.bookingFormContainer}>
              <Text size={500} weight="semibold" style={{ marginBottom: tokens.spacingVerticalM }}>
                Termin buchen: {formatDateSwiss(selectedDate)} um {selectedSlot}
              </Text>
              
              <div className={styles.formField}>
                <Label required>Terminbuchung</Label>
                <Dropdown
                  placeholder="Bitte auswählen"
                  value={bookingType}
                  onOptionSelect={(e, data) => setBookingType(data.optionValue)}
                >
                  <Option value="für mich">Für mich</Option>
                  <Option value="für jemand anders">Für jemand anders</Option>
                </Dropdown>
              </div>
              
              {bookingType === 'für jemand anders' && (
                <div className={styles.formField}>
                  <Label required>Ihre E-Mail-Adresse</Label>
                  <Input
                    type="email"
                    value={formData.userEmail}
                    onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
                    placeholder="ihre.email@beispiel.ch"
                  />
                </div>
              )}
              
              {bookingType && (
                <>
                  <div className={styles.formField}>
                    <Label required>{bookingType === 'für jemand anders' ? 'Name des neuen User*' : 'Name'}</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nachname eingeben"
                    />
                  </div>
                  
                  <div className={styles.formField}>
                    <Label required>{bookingType === 'für jemand anders' ? 'Vorname des neuen User*' : 'Vorname'}</Label>
                    <Input
                      value={formData.vorname}
                      onChange={(e) => setFormData({ ...formData, vorname: e.target.value })}
                      placeholder="Vorname eingeben"
                    />
                  </div>
                  
                  <div className={styles.formField}>
                    <Label required>{bookingType === 'für jemand anders' ? 'Email des neuen User*' : 'E-Mail-Adresse'}</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@beispiel.ch"
                    />
                  </div>
                  
                  <div className={styles.formField}>
                    <Label required>Hardware</Label>
                    <Dropdown
                      placeholder="Bitte auswählen"
                      value={formData.hardware}
                      onOptionSelect={(e, data) => setFormData({ ...formData, hardware: data.optionText })}
                    >
                      <Option value="ja">Ja</Option>
                      <Option value="nein">Nein</Option>
                    </Dropdown>
                  </div>
                  
                  <div style={{ display: 'flex', gap: tokens.spacingHorizontalS }}>
                    <Button appearance="primary">Termin buchen</Button>
                    <Button onClick={() => { 
                      setSelectedSlot(null); 
                      setBookingType(''); 
                      setFormData({
                        name: '',
                        vorname: '',
                        email: '',
                        hardware: '',
                        userEmail: '',
                      });
                    }}>Abbrechen</Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
      
      <div className={styles.spacer}></div>
      <div className={styles.contentWrapper}>
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
            size="small"
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
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
