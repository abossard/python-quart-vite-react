/**
 * Missing Devices Component - Vermisst
 * 
 * Zeigt alle als vermisst markierten Geräte
 */

import { useEffect, useState } from 'react'
import {
  makeStyles,
  tokens,
  Spinner,
  MessageBar,
  MessageBarBody,
  Button,
} from '@fluentui/react-components'
import {
  Warning24Regular,
  Checkmark24Regular,
} from '@fluentui/react-icons'
import PageHeader from '../../components/PageHeader'
import AdminCard from '../../components/AdminCard'
import ResponsiveGrid from '../../components/ResponsiveGrid'

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalXXL,
  },
  
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  },
  
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    gap: tokens.spacingVerticalL,
    color: tokens.colorNeutralForeground3,
  },
  
  emptyIcon: {
    fontSize: '64px',
  },
})

export default function MissingDevices() {
  const styles = useStyles()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load missing devices
  const loadMissingDevices = async () => {
    try {
      setLoading(true)
      
      // Lade vermisste Geräte aus devices_missing Tabelle
      const response = await fetch('http://localhost:5001/api/devices/missing', {
        credentials: 'include',
      })
      
      if (response.status === 401) {
        setError('Nicht authentifiziert. Bitte melden Sie sich an.')
        setLoading(false)
        return
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }
      
      const missingDevices = await response.json()
      
      setDevices(missingDevices)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMissingDevices()
    
    // Reload every 10 seconds to check for new missing devices
    const interval = setInterval(loadMissingDevices, 10000)
    
    return () => clearInterval(interval)
  }, [])
  
  // Handler für "Gefunden" Button
  const handleFoundDevice = async (device) => {
    try {
      // TODO: Implement API call to mark device as found
      // For now, just remove from list
      setDevices(prevDevices => prevDevices.filter(d => d.id !== device.id))
      
      // In real implementation, would call:
      // POST /api/devices/missing/{id}/found
      // Then update state
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className={styles.container}>
      <PageHeader 
        title="Vermisste Geräte" 
        subtitle="Übersicht aller als vermisst gemeldeten Geräte"
      />
      
      {error && (
        <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalL }}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      
      {loading ? (
        <div className={styles.loading}>
          <Spinner label="Vermisste Geräte werden geladen..." />
        </div>
      ) : devices.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Checkmark24Regular style={{ fontSize: '64px', color: tokens.colorPaletteGreenForeground1 }} />
          </div>
          <h2>Keine vermissten Geräte</h2>
          <p>Alle Geräte sind an ihrem Platz 👍</p>
        </div>
      ) : (
        <ResponsiveGrid>
          {devices.map((device) => {
            const fields = []
            
            // Seriennummer
            if (device.serial_number) {
              fields.push({ label: 'Seriennummer', value: device.serial_number })
            }
            
            // Inventarnummer
            if (device.inventory_number) {
              fields.push({ label: 'CM-Nummer', value: device.inventory_number })
            }
            
            // Letzter bekannter Standort
            if (device.location?.name) {
              fields.push({ label: 'Letzter Standort', value: device.location.name })
            }
            
            // Zuletzt ausgeliehen an
            if (device.borrower_name) {
              fields.push({ label: 'Zuletzt bei', value: device.borrower_name })
            }
            
            // Organisation
            let orgText = '-'
            if (device.department?.name && device.amt?.name) {
              orgText = `${device.department.name} / ${device.amt.name}`
            } else if (device.department?.name) {
              orgText = device.department.name
            }
            
            return (
              <AdminCard
                key={device.id}
                title={`${device.device_type || 'Gerät'} - ${device.manufacturer || ''}`}
                fields={fields}
                statusBackground="danger"
                onEdit={() => handleFoundDevice(device)}
                onDelete={null}
                showInfo={false}
              />
            )
          })}
        </ResponsiveGrid>
      )}
    </div>
  )
}
