/**
 * Dashboard Component - Ausleihgeräte Übersicht
 *
 * Zeigt Ausleihgeräte in einem 4-Spalten Grid
 * mit DeviceLoanCard und IssueDeviceModal
 */

import { useEffect, useState } from 'react'
import {
  makeStyles,
  tokens,
  Spinner,
  MessageBar,
  MessageBarBody,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
} from '@fluentui/react-components'
import {
  FilterRegular,
  FilterDismissRegular,
  HomeCheckmarkRegular,
  Dismiss20Regular,
} from '@fluentui/react-icons'
import DeviceLoanCard from '../../components/DeviceLoanCard'
import IssueDeviceModal from '../../components/IssueDeviceModal'
import ReturnDeviceModal from '../../components/ReturnDeviceModal'
import DetailDialog from '../../components/DetailDialog'

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalXXL,
  },
  
  headerContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '52px',
    gap: '24px',
    flexWrap: 'wrap',
  },
  
  headerTitle: {
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightHero700,
    color: tokens.colorNeutralForeground1,
    margin: '0',
  },
  
  statusButtons: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  
  countButton: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightMedium,
    padding: '6px 12px',
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: tokens.fontFamilyBase,
    outline: 'none',
    ':focus-visible': {
      outline: `2px solid ${tokens.colorBrandStroke1}`,
      outlineOffset: '2px',
    },
  },
  
  availableButton: {
    backgroundColor: '#ffffff',
    color: '#1e7e34',
    boxShadow: 'inset 0 0 0 1px rgba(40, 167, 69, 0.3)',
    ':hover': {
      backgroundColor: 'rgba(40, 167, 69, 0.05)',
    },
  },
  
  availableButtonActive: {
    backgroundColor: 'rgba(40, 167, 69, 0.15)',
    color: '#1e7e34',
    boxShadow: 'inset 0 0 0 1px rgba(40, 167, 69, 0.3)',
    ':hover': {
      backgroundColor: 'rgba(40, 167, 69, 0.15)',
    },
  },
  
  issuedButton: {
    backgroundColor: '#ffffff',
    color: '#bd2130',
    boxShadow: 'inset 0 0 0 1px rgba(220, 53, 69, 0.3)',
    ':hover': {
      backgroundColor: 'rgba(220, 53, 69, 0.05)',
    },
  },
  
  issuedButtonActive: {
    backgroundColor: 'rgba(220, 53, 69, 0.15)',
    color: '#bd2130',
    boxShadow: 'inset 0 0 0 1px rgba(220, 53, 69, 0.3)',
    ':hover': {
      backgroundColor: 'rgba(220, 53, 69, 0.15)',
    },
  },
  
  countNumber: {
    fontWeight: tokens.fontWeightSemibold,
  },
  
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  
  locationButton: {
    padding: '0',
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightRegular,
    borderRadius: '6px',
    border: '1px solid #0d6efd',
    backgroundColor: '#0d6efd',
    color: '#ffffff',
    boxShadow: tokens.shadow4,
    transition: 'all 0.15s ease',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '42px',
    height: '42px',
    minWidth: '42px',
    minHeight: '42px',
    ':hover': {
      backgroundColor: '#0b5ed7',
      borderColor: '#0b5ed7',
    },
  },
  
  divider: {
    width: '1px',
    height: '32px',
    backgroundColor: '#dee2e6',
    margin: '0 4px',
  },
  
  resetButton: {
    padding: '0',
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightRegular,
    borderRadius: '6px',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: '#0d6efd',
    color: '#ffffff',
    boxShadow: tokens.shadow4,
    transition: 'all 0.15s ease',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '42px',
    height: '42px',
    minWidth: '42px',
    minHeight: '42px',
    ':hover': {
      backgroundColor: '#0b5ed7',
      borderColor: '#0b5ed7',
    },
  },
  
  resetButtonActive: {
    backgroundColor: '#dc3545',
    borderColor: '#dc3545',
    color: '#ffffff',
    ':hover': {
      backgroundColor: '#bb2d3b',
      borderColor: '#bb2d3b',
    },
  },
  
  activeMenuItem: {
    fontFamily: tokens.fontFamilyBase,
    backgroundColor: '#0d6efd',
    color: '#ffffff',
    ':hover': {
      backgroundColor: '#3d8bfd',
    },
  },
  
  categoryButton: {
    padding: '10px 16px',
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightRegular,
    lineHeight: tokens.lineHeightBase300,
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#ffffff',
    boxShadow: `inset 0 0 0 1px rgba(0, 0, 0, 0.2), ${tokens.shadow4}`,
    transition: 'all 0.15s ease',
    cursor: 'pointer',
    color: tokens.colorNeutralForeground1,
    whiteSpace: 'nowrap',
    ':hover': {
      backgroundColor: 'rgba(13, 110, 253, 0.1)',
    },
  },
  
  categoryButtonActive: {
    fontFamily: tokens.fontFamilyBase,
    backgroundColor: '#0d6efd',
    color: '#ffffff',
    boxShadow: `inset 0 0 0 1px #0d6efd, ${tokens.shadow4}`,
    padding: '10px 16px',
    ':hover': {
      backgroundColor: '#0d6efd',
    },
  },
  
  removeIconContainer: {
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    padding: '0 12px',
    marginLeft: '12px',
    marginTop: '-10px',
    marginBottom: '-10px',
    marginRight: '-1px',
    borderLeft: '1px solid rgba(255, 255, 255, 0.3)',
    borderTopRightRadius: '6px',
    borderBottomRightRadius: '6px',
    transition: 'all 0.15s ease',
    cursor: 'pointer',
    ':hover': {
      backgroundColor: '#f44336',
      '& svg': {
        color: '#ffffff',
      },
    },
  },
  
  removeIcon: {
    color: '#dc3545',
    fontSize: '16px',
  },
  
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '24px',
    '@media (max-width: 1400px)': {
      gridTemplateColumns: 'repeat(3, 1fr)',
    },
    '@media (max-width: 1024px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr',
    },
  },
  
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  },
})

export default function Dashboard({ searchValue = '' }) {
  const styles = useStyles()
  const [devices, setDevices] = useState([])
  const [locations, setLocations] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Berechtigungslogik für Servicedesk
  const isServicedesk = currentUser?.role === 'servicedesk'

  console.log('Dashboard rendering, devices:', devices.length, 'locations:', locations.length)
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailDevice, setDetailDevice] = useState(null)
  
  // Filter state
  const [selectedLocationId, setSelectedLocationId] = useState(null)
  const [activeCategories, setActiveCategories] = useState([])
  const [statusFilter, setStatusFilter] = useState(null) // 'available', 'issued', or null
  
  // Get selected location name
  const selectedLocation = locations.find(loc => loc.id === selectedLocationId)
  const locationName = selectedLocation?.name || 'Alle Standorte'
  
  // Filter devices by location first (for computing available categories)
  const locationFilteredDevices = devices.filter(device => {
    // Location filter only
    if (selectedLocationId && device.location_id !== selectedLocationId) {
      return false
    }
    return true
  })
  
  // Extract unique categories from location-filtered devices (dynamic filter options)
  const categories = [...new Set(locationFilteredDevices.map(d => d.device_type).filter(Boolean))].sort()
  
  // Filter devices based on location, category, status, and search value
  const filteredDevices = locationFilteredDevices.filter(device => {
    // Category filter - allow multiple selections
    if (activeCategories.length > 0 && !activeCategories.includes(device.device_type)) {
      return false
    }
    
    // Status filter
    if (statusFilter === 'available' && device.status !== 'available') {
      return false
    }
    if (statusFilter === 'issued' && device.status === 'available') {
      return false
    }
    
    // Search filter
    if (searchValue) {
      const search = searchValue.toLowerCase()
      return (
        device.device_type?.toLowerCase().includes(search) ||
        device.manufacturer?.toLowerCase().includes(search) ||
        device.model?.toLowerCase().includes(search) ||
        device.serial_number?.toLowerCase().includes(search) ||
        device.inventory_number?.toLowerCase().includes(search) ||
        device.borrower_name?.toLowerCase().includes(search) ||
        device.amt?.name?.toLowerCase().includes(search) ||
        device.department?.name?.toLowerCase().includes(search) ||
        device.location?.name?.toLowerCase().includes(search)
      )
    }
    
    return true
  })

  // Load current user
  const loadCurrentUser = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/auth/me', {
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('Current user loaded:', data.user)
        setCurrentUser(data.user)
        // Set default location from user ONLY if user has a location assigned
        // Users without location (location_id = null) always see "Alle Standorte"
        if (data.user?.location_id) {
          setSelectedLocationId(data.user.location_id)
        } else {
          // User without location → force "Alle Standorte"
          setSelectedLocationId(null)
        }
      } else {
        console.warn('Failed to load current user, status:', response.status)
      }
    } catch (err) {
      console.error('Failed to load current user:', err)
      setError(`Fehler beim Laden des Benutzers: ${err.message}`)
    }
  }
  
  // Load locations
  const loadLocations = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/locations', {
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('Locations loaded:', data.length)
        setLocations(data)
      } else {
        console.warn('Failed to load locations, status:', response.status)
      }
    } catch (err) {
      console.error('Failed to load locations:', err)
      setError(`Fehler beim Laden der Standorte: ${err.message}`)
    }
  }
  
  // Load devices
  const loadDevices = async (showLoadingIndicator = true) => {
    try {
      if (showLoadingIndicator) {
        setLoading(true)
      }
      const response = await fetch('http://localhost:5001/api/devices', {
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setDevices(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      if (showLoadingIndicator) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    // Initial load with loading indicator
    loadCurrentUser()
    loadLocations()
    loadDevices(true)
    
    // Auto-refresh devices every 10 seconds in background (smooth)
    const interval = setInterval(() => loadDevices(false), 10000)
    
    return () => clearInterval(interval)
  }, [])

  // Handler für "Herausgeben" Button
  const handleIssueClick = (device) => {
    if (isServicedesk) return
    setSelectedDevice(device)
    setIssueModalOpen(true)
  }

  // Handler für "Zurücknehmen" Button - öffnet Modal
  const handleReturnClick = (device) => {
    if (isServicedesk) return
    setSelectedDevice(device)
    setReturnModalOpen(true)
  }
  
  // Handler für Return Modal "Zurücknehmen" Aktion
  const handleReturnConfirm = async () => {
    if (!selectedDevice) return
    
    try {
      const response = await fetch(`http://localhost:5001/api/devices/${selectedDevice.id}/return`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: `Gerät zurückgenommen von ${selectedDevice.borrower_name || 'Unbekannt'}`,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Fehler beim Zurücknehmen')
      }
      
      // Get updated device from response
      const updatedDevice = await response.json()
      
      // Update only the affected device in state (optimistic UI update)
      // Status wechselt von "borrowed" zu "available"
      // borrower_name wird auf null gesetzt
      setDevices(prevDevices => 
        prevDevices.map(device => 
          device.id === selectedDevice.id ? updatedDevice : device
        )
      )
    } catch (err) {
      setError(err.message)
    }
  }
  
  // Handler für Return Modal "Vermisst" Aktion
  const handleMarkMissing = async () => {
    if (!selectedDevice) return
    
    try {
      // First get current user info
      const userResponse = await fetch('http://localhost:5001/api/auth/me', {
        credentials: 'include',
      })
      
      if (!userResponse.ok) {
        throw new Error('Nicht authentifiziert')
      }
      
      const currentUser = await userResponse.json()
      
      // Use the dedicated missing endpoint
      const response = await fetch(`http://localhost:5001/api/devices/${selectedDevice.id}/missing`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reported_by_user_id: currentUser.user.id,
          last_known_location_id: selectedDevice.location?.id || selectedDevice.location_id || null,
          notes: `Gerät als vermisst markiert. Zuletzt bei: ${selectedDevice.borrower_name || 'Unbekannt'}`,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Missing device error:', errorData)
        const errorMsg = errorData.details 
          ? `Validation error: ${JSON.stringify(errorData.details)}` 
          : errorData.error || 'Fehler beim Markieren als Vermisst'
        throw new Error(errorMsg)
      }
      
      // Remove device from list (vermisste Geräte werden in separater Ansicht angezeigt)
      setDevices(prevDevices => 
        prevDevices.filter(device => device.id !== selectedDevice.id)
      )
    } catch (err) {
      setError(err.message)
    }
  }
  
  // Handler für Info-Icon
  const handleInfoClick = (device) => {
    setDetailDevice(device)
    setDetailDialogOpen(true)
  }
  
  // Handler für Modal Submit
  const handleIssueSubmit = async (borrowData) => {
    if (!selectedDevice) return
    
    try {
      const response = await fetch(`http://localhost:5001/api/devices/${selectedDevice.id}/borrow`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(borrowData),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Fehler beim Herausgeben')
      }
      
      // Get updated device from response
      const updatedDevice = await response.json()
      
      // Update only the affected device in state (optimistic UI update)
      setDevices(prevDevices => 
        prevDevices.map(device => 
          device.id === selectedDevice.id ? updatedDevice : device
        )
      )
      
      // Close modal after successful operation
      setIssueModalOpen(false)
    } catch (err) {
      throw err
    }
  }

  return (
    <div className={styles.container}>
      {/* Header with title and status buttons */}
      <div className={styles.headerContainer}>
        <h1 className={styles.headerTitle}>
          Ausleihgeräte {locationName}
        </h1>
        <div className={styles.statusButtons}>
          <button
            className={`${styles.countButton} ${styles.availableButton} ${statusFilter === 'available' ? styles.availableButtonActive : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'available' ? null : 'available')}
            aria-label="Nur verfügbare Geräte anzeigen"
          >
            <span className={styles.countNumber}>{locationFilteredDevices.filter(d => d.status === 'available').length}</span>
            <span>verfügbar</span>
          </button>
          <button
            className={`${styles.countButton} ${styles.issuedButton} ${statusFilter === 'issued' ? styles.issuedButtonActive : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'issued' ? null : 'issued')}
            aria-label="Nur herausgegebene Geräte anzeigen"
          >
            <span className={styles.countNumber}>{locationFilteredDevices.filter(d => d.status !== 'available').length}</span>
            <span>herausgegeben</span>
          </button>
        </div>
      </div>
      
      {/* Filter bar */}
      <div className={styles.filterBar}>
        {/* Location selector button */}
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <button className={styles.locationButton} aria-label="Standort wählen">
              <HomeCheckmarkRegular style={{ width: '20px', height: '20px' }} />
            </button>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem 
                onClick={() => setSelectedLocationId(null)}
                className={selectedLocationId === null ? styles.activeMenuItem : ''}
              >
                Alle Standorte
              </MenuItem>
              {locations.map(location => (
                <MenuItem 
                  key={location.id}
                  onClick={() => setSelectedLocationId(location.id)}
                  className={selectedLocationId === location.id ? styles.activeMenuItem : ''}
                >
                  {location.name}
                </MenuItem>
              ))}
            </MenuList>
          </MenuPopover>
        </Menu>
        
        {/* Divider */}
        <div className={styles.divider} />
        
        {/* Reset filter button */}
        <button 
          className={`${styles.resetButton} ${activeCategories.length > 0 ? styles.resetButtonActive : ''}`}
          onClick={() => setActiveCategories([])}
          aria-label="Filter zurücksetzen"
        >
          {activeCategories.length > 0 ? (
            <FilterDismissRegular style={{ width: '20px', height: '20px' }} />
          ) : (
            <FilterRegular style={{ width: '20px', height: '20px' }} />
          )}
        </button>
        
        {/* Category filter buttons */}
        {categories.map(category => (
          <button
            key={category}
            className={`${styles.categoryButton} ${activeCategories.includes(category) ? styles.categoryButtonActive : ''}`}
            onClick={() => {
              if (activeCategories.includes(category)) {
                setActiveCategories(activeCategories.filter(c => c !== category))
              } else {
                setActiveCategories([...activeCategories, category])
              }
            }}
          >
            <span>{category}</span>
          </button>
        ))}
      </div>
      
      {error && (
        <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalL }}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      
      {loading ? (
        <div className={styles.loading}>
          <Spinner label="Geräte werden geladen..." />
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredDevices.map((device) => {
            // Build fields array
            const fields = []
            
            // Office Version (optional)
            if (device.office_version) {
              fields.push({ label: 'Office Version', value: device.office_version })
            }
            
            // CM-Nummer
            if (device.inventory_number) {
              fields.push({ label: 'CM-Nummer', value: device.inventory_number })
            }
            
            // Standort
            if (device.location?.name) {
              fields.push({ label: 'Standort', value: device.location.name })
            }
            
            return (
              <DeviceLoanCard
                key={device.id}
                category={device.device_type || 'Gerät'}
                subtitle={device.model ? `${device.manufacturer || ''} ${device.model}`.trim() : device.manufacturer || '-'}
                fields={fields}
                department={device.department?.name}
                amt={device.amt?.name}
                status={device.status === 'available' ? 'available' : 'issued'}
                borrowerName={device.borrower_name || null}
                onIssueClick={() => handleIssueClick(device)}
                onReturnClick={() => handleReturnClick(device)}
                onInfoClick={() => handleInfoClick(device)}
                disableActions={isServicedesk}
              />
            )
          })}
        </div>
      )}
      
      {/* Issue Device Modal */}
      {!isServicedesk && (
        <IssueDeviceModal
          open={issueModalOpen}
          onOpenChange={(_, data) => setIssueModalOpen(data.open)}
          onSubmit={handleIssueSubmit}
          deviceInfo={selectedDevice}
        />
      )}
      {/* Return Device Modal */}
      {!isServicedesk && (
        <ReturnDeviceModal
          open={returnModalOpen}
          onOpenChange={(_, data) => setReturnModalOpen(data.open)}
          deviceName={selectedDevice ? `${selectedDevice.device_type || 'Gerät'}` : 'Gerät'}
          onReturn={handleReturnConfirm}
          onMarkMissing={handleMarkMissing}
        />
      )}
      
      {/* Detail Dialog */}
      <DetailDialog
        open={detailDialogOpen}
        onOpenChange={(_, data) => setDetailDialogOpen(data.open)}
        data={detailDevice}
      />
    </div>
  )
}
