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
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Field,
  Input,
  Dropdown,
  Option,
} from '@fluentui/react-components'
import {
  Warning24Regular,
  Checkmark24Regular,
  Info24Regular,
  Edit24Regular,
  ArrowUndo24Regular,
  Delete24Regular,
} from '@fluentui/react-icons'
import PageHeader from '../../components/PageHeader'
import AdminCard from '../../components/AdminCard'
import ResponsiveGrid from '../../components/ResponsiveGrid'
import DetailDialog from '../../components/DetailDialog'

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
  
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingHorizontalM,
  },
  
  fullWidth: {
    gridColumn: '1 / -1',
  },
})

export default function MissingDevices({ searchValue = '' }) {
  const styles = useStyles()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  
  // Check if user has editor role or higher (editor, redakteur, admin)
  const canEditDevices = currentUser && ['editor', 'redakteur', 'admin'].includes(currentUser.role)
  
  // Filter devices based on search
  const filteredDevices = devices.filter(device => {
    if (!searchValue) return true
    const search = searchValue.toLowerCase()
    return (
      device.device_type?.toLowerCase().includes(search) ||
      device.manufacturer?.toLowerCase().includes(search) ||
      device.model?.toLowerCase().includes(search) ||
      device.serial_number?.toLowerCase().includes(search) ||
      device.inventory_number?.toLowerCase().includes(search) ||
      device.reported_by?.toLowerCase().includes(search) ||
      device.resolved_by?.toLowerCase().includes(search) ||
      device.department?.name?.toLowerCase().includes(search) ||
      device.amt?.name?.toLowerCase().includes(search) ||
      device.notes?.toLowerCase().includes(search)
    )
  })
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deviceToDelete, setDeviceToDelete] = useState(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deviceToEdit, setDeviceToEdit] = useState(null)
  
  // Reference data
  const [departments, setDepartments] = useState([])
  const [amts, setAmts] = useState([])
  const [filteredAmts, setFilteredAmts] = useState([])
  
  // Form data for editing
  const [formData, setFormData] = useState({
    device_type: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    inventory_number: '',
    location_id: '1',
    department_id: null,
    amt_id: null,
    notes: '',
  })

  // Load missing devices
  const loadMissingDevices = async (showLoadingIndicator = true) => {
    try {
      if (showLoadingIndicator) {
        setLoading(true)
      }
      
      // Lade vermisste Geräte aus devices_missing Tabelle
      const response = await fetch('http://localhost:5001/api/devices/missing', {
        credentials: 'include',
      })
      
      if (response.status === 401) {
        setError('Nicht authentifiziert. Bitte melden Sie sich an.')
        if (showLoadingIndicator) {
          setLoading(false)
        }
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
      if (showLoadingIndicator) {
        setLoading(false)
      }
    }
  }

  // Load departments
  const loadDepartments = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/departments', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setDepartments(data)
      }
    } catch (err) {
      console.error('Failed to load departments:', err)
    }
  }

  // Load amts
  const loadAmts = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/amts', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setAmts(data)
      }
    } catch (err) {
      console.error('Failed to load amts:', err)
    }
  }

  // Filter amts by department
  useEffect(() => {
    if (formData.department_id) {
      setFilteredAmts(amts.filter(a => a.department_id === formData.department_id))
    } else {
      setFilteredAmts([])
    }
  }, [formData.department_id, amts])

  const loadCurrentUser = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/auth/session', {
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.authenticated) {
          setCurrentUser(data.user)
        }
      }
    } catch (err) {
      console.error('Failed to load current user:', err)
    }
  }

  useEffect(() => {
    // Initial load with loading indicator
    loadMissingDevices(true)
    loadDepartments()
    loadAmts()
    loadCurrentUser()
    
    // Reload every 10 seconds in background without loading indicator (smoother)
    const interval = setInterval(() => loadMissingDevices(false), 10000)
    
    return () => clearInterval(interval)
  }, [])
  
  // Handler für Info-Button (1)
  const handleInfo = (device) => {
    setSelectedDevice(device)
    setDetailDialogOpen(true)
  }

  // Handler für Edit-Button (2)
  const handleEdit = (device) => {
    setDeviceToEdit(device)
    // Populate form with all device fields
    setFormData({
      device_type: device.device_type || '',
      manufacturer: device.manufacturer || '',
      model: device.model || '',
      serial_number: device.serial_number || '',
      inventory_number: device.inventory_number || '',
      location_id: device.location_id?.toString() || '1',
      department_id: device.department_id || null,
      amt_id: device.amt_id || null,
      notes: device.notes || '',
    })
    setEditDialogOpen(true)
  }

  const handleEditConfirm = async () => {
    if (!deviceToEdit) return
    
    try {
      const response = await fetch(`http://localhost:5001/api/devices/missing/${deviceToEdit.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_type: formData.device_type,
          manufacturer: formData.manufacturer,
          model: formData.model,
          serial_number: formData.serial_number,
          inventory_number: formData.inventory_number,
          location_id: parseInt(formData.location_id),
          department_id: formData.department_id,
          amt_id: formData.amt_id,
          notes: formData.notes,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Fehler beim Aktualisieren')
      }
      
      // Update in list - merge formData into the device
      setDevices(prevDevices => 
        prevDevices.map(d => 
          d.id === deviceToEdit.id 
            ? { 
                ...d, 
                device_type: formData.device_type,
                manufacturer: formData.manufacturer,
                model: formData.model,
                serial_number: formData.serial_number,
                inventory_number: formData.inventory_number,
                location_id: parseInt(formData.location_id),
                department_id: formData.department_id,
                amt_id: formData.amt_id,
                notes: formData.notes,
              }
            : d
        )
      )
      
      setEditDialogOpen(false)
      setDeviceToEdit(null)
      // Reset formData to initial state
      setFormData({
        device_type: '',
        manufacturer: '',
        model: '',
        serial_number: '',
        inventory_number: '',
        location_id: '1',
        department_id: null,
        amt_id: null,
        notes: '',
      })
    } catch (err) {
      setError(err.message)
    }
  }

  // Handler für Restore-Button (3) - Gerät als "gefunden" markieren
  const handleRestore = async (device) => {
    try {
      const response = await fetch(`http://localhost:5001/api/devices/missing/${device.id}/restore`, {
        method: 'POST',
        credentials: 'include',
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Fehler beim Wiederherstellen')
      }
      
      // Remove from missing devices list
      setDevices(prevDevices => prevDevices.filter(d => d.id !== device.id))
    } catch (err) {
      setError(err.message)
    }
  }

  // Handler für Delete-Button (4)
  const handleDeleteClick = (device) => {
    setDeviceToDelete(device)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deviceToDelete) return
    
    try {
      const response = await fetch(`http://localhost:5001/api/devices/missing/${deviceToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Fehler beim Löschen')
      }
      
      // Remove from list
      setDevices(prevDevices => prevDevices.filter(d => d.id !== deviceToDelete.id))
      setDeleteDialogOpen(false)
      setDeviceToDelete(null)
    } catch (err) {
      setError(err.message)
      setDeleteDialogOpen(false)
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
          {filteredDevices.map((device) => {
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
                // Custom action buttons für vermisste Geräte
                actionButtons={[
                  {
                    icon: <Info24Regular />,
                    onClick: () => handleInfo(device),
                    title: 'Info',
                    colorClass: 'infoButton', // grau
                    disabled: false, // Info immer erlaubt
                  },
                  {
                    icon: <Edit24Regular />,
                    onClick: () => handleEdit(device),
                    title: 'Bearbeiten',
                    colorClass: 'editButton', // blau
                    disabled: !canEditDevices,
                    disabledTitle: 'Nur Editor, Redakteur oder Admin können bearbeiten',
                  },
                  {
                    icon: <ArrowUndo24Regular />,
                    onClick: () => handleRestore(device),
                    title: 'Wiederherstellen (Gefunden)',
                    colorClass: 'restoreButton', // grün
                    disabled: !canEditDevices,
                    disabledTitle: 'Nur Editor, Redakteur oder Admin können wiederherstellen',
                  },
                  {
                    icon: <Delete24Regular />,
                    onClick: () => handleDeleteClick(device),
                    title: 'Löschen',
                    colorClass: 'deleteButton', // rot
                    disabled: !canEditDevices,
                    disabledTitle: 'Nur Editor, Redakteur oder Admin können löschen',
                  },
                ]}
              />
            )
          })}
        </ResponsiveGrid>
      )}

      {/* Detail Dialog */}
      <DetailDialog
        open={detailDialogOpen}
        onOpenChange={(_, data) => setDetailDialogOpen(data.open)}
        data={selectedDevice}
      />

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(e, data) => setEditDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Gerät bearbeiten</DialogTitle>
            <DialogContent>
              <div className={styles.formGrid}>
                <Field label="Device Type" required>
                  <Input
                    value={formData.device_type}
                    onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}
                    placeholder="e.g., Laptop, Beamer"
                  />
                </Field>
                <Field label="Manufacturer" required>
                  <Input
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    placeholder="e.g., Dell, HP"
                  />
                </Field>
                <Field label="Model" required>
                  <Input
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="e.g., Latitude 7490"
                  />
                </Field>
                <Field label="Serial Number">
                  <Input
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Inventory Number">
                  <Input
                    value={formData.inventory_number}
                    onChange={(e) => setFormData({ ...formData, inventory_number: e.target.value })}
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Location" required>
                  <Dropdown
                    value={formData.location_id === '1' ? 'Bollwerk' : formData.location_id === '2' ? 'Zollikofen' : 'Guisanplatz'}
                    onOptionSelect={(_, data) => setFormData({ ...formData, location_id: data.optionValue })}
                  >
                    <Option value="1">Bollwerk</Option>
                    <Option value="2">Zollikofen</Option>
                    <Option value="3">Guisanplatz</Option>
                  </Dropdown>
                </Field>
                <Field label="Department">
                  <Dropdown
                    placeholder="Select department"
                    value={departments.find(d => d.id === formData.department_id)?.name || ''}
                    onOptionSelect={(_, data) => {
                      const deptId = parseInt(data.optionValue)
                      setFormData({ ...formData, department_id: deptId, amt_id: null })
                    }}
                  >
                    {departments.map(dept => (
                      <Option key={dept.id} value={dept.id.toString()}>{dept.name}</Option>
                    ))}
                  </Dropdown>
                </Field>
                <Field label="Amt" disabled={!formData.department_id}>
                  <Dropdown
                    placeholder={formData.department_id ? "Select amt" : "Select department first"}
                    value={filteredAmts.find(a => a.id === formData.amt_id)?.name || ''}
                    onOptionSelect={(_, data) => setFormData({ ...formData, amt_id: parseInt(data.optionValue) })}
                    disabled={!formData.department_id}
                  >
                    {filteredAmts.map(amt => (
                      <Option key={amt.id} value={amt.id.toString()}>{amt.name}</Option>
                    ))}
                  </Dropdown>
                </Field>
                <Field label="Notes" className={styles.fullWidth}>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optional notes"
                  />
                </Field>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setEditDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button appearance="primary" onClick={handleEditConfirm}>
                Speichern
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(e, data) => setDeleteDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Gerät löschen</DialogTitle>
            <DialogContent>
              Möchten Sie das Gerät "{deviceToDelete?.device_type} - {deviceToDelete?.manufacturer}" wirklich permanent löschen?
              <br /><br />
              <strong>Diese Aktion kann nicht rückgängig gemacht werden.</strong>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setDeleteDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button 
                appearance="primary" 
                onClick={handleDeleteConfirm}
                style={{ backgroundColor: tokens.colorPaletteRedBackground3, color: '#FFFFFF' }}
              >
                Löschen
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  )
}
