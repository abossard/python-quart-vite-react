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

export default function Dashboard() {
  const styles = useStyles()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailDevice, setDetailDevice] = useState(null)

  // Load devices
  const loadDevices = async () => {
    try {
      setLoading(true)
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
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDevices()
  }, [])

  // Handler für "Herausgeben" Button
  const handleIssueClick = (device) => {
    setSelectedDevice(device)
    setIssueModalOpen(true)
  }
  
  // Handler für "Zurücknehmen" Button
  const handleReturnClick = async (device) => {
    try {
      const response = await fetch(`http://localhost:5001/api/devices/${device.id}/return`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error('Fehler beim Zurücknehmen')
      }
      
      // Reload devices
      await loadDevices()
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
  const handleIssueSubmit = async (personName) => {
    if (!selectedDevice) return
    
    try {
      const response = await fetch(`http://localhost:5001/api/devices/${selectedDevice.id}/borrow`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          borrower_name: personName,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Fehler beim Herausgeben')
      }
      
      // Reload devices
      await loadDevices()
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
          {devices.map((device) => {
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
            
            // Organisation text (Department / Amt)
            let orgText = '-'
            if (device.department?.name && device.amt?.name) {
              orgText = `${device.department.name} / ${device.amt.name}`
            } else if (device.department?.name) {
              orgText = device.department.name
            }
            
            return (
              <DeviceLoanCard
                key={device.id}
                category={device.device_type || 'Gerät'}
                subtitle={device.model ? `${device.manufacturer || ''} ${device.model}`.trim() : device.manufacturer || '-'}
                fields={fields}
                orgText={orgText}
                status={device.status === 'available' ? 'available' : 'issued'}
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
      
      {/* Detail Dialog */}
      <DetailDialog
        open={detailDialogOpen}
        onOpenChange={(_, data) => setDetailDialogOpen(data.open)}
        data={detailDevice}
      />
    </div>
  )
}
