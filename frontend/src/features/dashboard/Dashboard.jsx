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
} from '@fluentui/react-components'
import DeviceLoanCard from '../../components/DeviceLoanCard'
import IssueDeviceModal from '../../components/IssueDeviceModal'
import ReturnDeviceModal from '../../components/ReturnDeviceModal'
import PageHeader from '../../components/PageHeader'
import DetailDialog from '../../components/DetailDialog'

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalXXL,
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailDevice, setDetailDevice] = useState(null)
  
  // Filter devices based on search value
  const filteredDevices = devices.filter(device => {
    if (!searchValue) return true
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
  })

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
    loadDevices(true)
    
    // Auto-refresh every 10 seconds in background (smooth)
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
    } catch (err) {
      throw err
    }
  }

  return (
    <div className={styles.container}>
      <PageHeader 
        title="Ausleihgeräte" 
        subtitle="Übersicht aller verfügbaren Geräte"
      />
      
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
