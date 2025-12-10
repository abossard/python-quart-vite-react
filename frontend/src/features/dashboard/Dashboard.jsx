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
  
  headerTitle: {
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightHero700,
    color: tokens.colorNeutralForeground1,
    marginBottom: '52px',
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
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
    transition: 'all 0.15s ease',
    cursor: 'pointer',
    color: tokens.colorNeutralForeground1,
    whiteSpace: 'nowrap',
    ':hover': {
      backgroundColor: '#0d6efd',
      color: '#ffffff',
      boxShadow: tokens.shadow8,
      borderColor: '#0d6efd',
    },
  },
  
  categoryButtonActive: {
    fontFamily: tokens.fontFamilyBase,
    backgroundColor: '#0d6efd',
    color: '#ffffff',
    borderColor: '#0d6efd',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0',
    padding: '10px 0 10px 16px',
    overflow: 'hidden',
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
  
  console.log('Dashboard rendering, devices:', devices.length, 'locations:', locations.length)
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailDevice, setDetailDevice] = useState(null)
  
  // Filter state
  const [selectedLocationId, setSelectedLocationId] = useState(null)
  const [activeCategories, setActiveCategories] = useState([])
  
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
  
  // Filter devices based on location, category, and search value
  const filteredDevices = locationFilteredDevices.filter(device => {
    // Category filter - allow multiple selections
    if (activeCategories.length > 0 && !activeCategories.includes(device.device_type)) {
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
        // Set default location from user
        if (data.user?.location_id) {
          setSelectedLocationId(data.user.location_id)
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
    setSelectedDevice(device)
    setIssueModalOpen(true)
  }
  
  // Handler für "Zurücknehmen" Button - öffnet Modal
  const handleReturnClick = (device) => {
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
      {/* Custom title with location */}
      <h1 className={styles.headerTitle}>
        Ausleihgeräte {locationName}
      </h1>
      
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
              if (!activeCategories.includes(category)) {
                setActiveCategories([...activeCategories, category])
              }
            }}
          >
            <span>{category}</span>
            {activeCategories.includes(category) && (
              <div 
                className={styles.removeIconContainer}
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveCategories(activeCategories.filter(c => c !== category))
                }}
              >
                <Dismiss20Regular className={styles.removeIcon} />
              </div>
            )}
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
              />
            )
          })}
        </div>
      )}
      
      {/* Issue Device Modal */}
      <IssueDeviceModal
        open={issueModalOpen}
        onOpenChange={(_, data) => setIssueModalOpen(data.open)}
        onSubmit={handleIssueSubmit}
        deviceInfo={selectedDevice}
      />
      
      {/* Return Device Modal */}
      <ReturnDeviceModal
        open={returnModalOpen}
        onOpenChange={(_, data) => setReturnModalOpen(data.open)}
        deviceName={selectedDevice ? `${selectedDevice.device_type || 'Gerät'}` : 'Gerät'}
        onReturn={handleReturnConfirm}
        onMarkMissing={handleMarkMissing}
      />
      
      {/* Detail Dialog */}
      <DetailDialog
        open={detailDialogOpen}
        onOpenChange={(_, data) => setDetailDialogOpen(data.open)}
        data={detailDevice}
      />
    </div>
  )
}
