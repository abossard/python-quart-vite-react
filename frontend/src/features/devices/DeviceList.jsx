/**
 * DeviceList Component
 * 
 * Device management interface with CRUD operations
 * Demonstrates FluentUI and authentication integration
 */

import { useEffect, useState } from 'react'
import {
  makeStyles,
  tokens,
  Title3,
  Text,
  Button,
  Badge,
  Spinner,
  MessageBar,
  MessageBarBody,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Field,
  Input,
  Dropdown,
  Option,
  Textarea,
  Card,
  CardHeader,
  Radio,
  RadioGroup,
} from '@fluentui/react-components'
import {
  Add24Regular,
  ArrowSync24Regular,
  CheckmarkCircle24Regular,
  DismissCircle24Regular,
} from '@fluentui/react-icons'
import { connectToEventsStream } from '../../services/api'
import AdminCard from '../../components/AdminCard'
import ResponsiveGrid from '../../components/ResponsiveGrid'
import PageHeader from '../../components/PageHeader'

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalXXL,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalXL,
  },
  headerTitle: {
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightHero700,
    color: tokens.colorNeutralForeground1,
    margin: '0',
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalXL,
  },
  statCard: {
    padding: tokens.spacingVerticalL,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: tokens.colorBrandForeground1,
  },
  gridContainer: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    padding: tokens.spacingVerticalL,
  },
  statusBadge: {
    textTransform: 'capitalize',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingHorizontalM,
  },
  fullWidth: {
    gridColumn: '1 / -1',
  },
  radioGroup: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalL,
    '& label': {
      fontWeight: '400',
    },
  },
  boldLabel: {
    fontWeight: '700',
  },
  extraInfoLabel: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#212529',
    marginBottom: '8px',
  },
  textarea: {
    width: '100%',
    minHeight: '84px',
    border: '1px solid #CED4DA',
    borderRadius: '6px',
    backgroundColor: '#F8F8F8',
    padding: '12px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
})

export default function DeviceList({ searchValue = '' }) {
  const styles = useStyles()
  const [devices, setDevices] = useState([])
  const [stats, setStats] = useState(null)
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
      device.location?.name?.toLowerCase().includes(search) ||
      device.department?.name?.toLowerCase().includes(search) ||
      device.amt?.name?.toLowerCase().includes(search) ||
      device.borrower_name?.toLowerCase().includes(search) ||
      device.notes?.toLowerCase().includes(search)
    )
  })
  const [locations, setLocations] = useState([])
  const [departments, setDepartments] = useState([])
  const [amts, setAmts] = useState([])
  const [filteredAmts, setFilteredAmts] = useState([])
  const [peripherals, setPeripherals] = useState([])
  const [deviceCategory, setDeviceCategory] = useState('bab-client')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [validationError, setValidationError] = useState(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deviceToEdit, setDeviceToEdit] = useState(null)
  const [deviceToDelete, setDeviceToDelete] = useState(null)
  const [formData, setFormData] = useState({
    asset_tag: '',
    inventory_number: '',
    device_type: '',
    model: '',
    windows_version: '',
    location_id: '1',
    department_id: null,
    amt_id: null,
    notes: '',
  })

  const loadDevices = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/devices', {
        credentials: 'include',
      })
      
      if (response.status === 401) {
        setAuthenticated(false)
        setError('Please login first')
        return
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setDevices(data)
      setAuthenticated(true)
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/devices/stats', {
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }

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

  const loadLocations = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/locations', {
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        setLocations(data)
      }
    } catch (err) {
      console.error('Failed to load locations:', err)
    }
  }

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

  const loadPeripherals = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/peripherals', {
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        setPeripherals(data)
      }
    } catch (err) {
      console.error('Failed to load peripherals:', err)
    }
  }

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

  const loadData = async () => {
    setLoading(true)
    await Promise.all([loadDevices(), loadStats(), loadLocations(), loadDepartments(), loadAmts(), loadPeripherals(), loadCurrentUser()])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    
    // Connect to real-time events
    const cleanup = connectToEventsStream(
      (event) => {
        // Reload data when device events occur
        if (event.type && event.type.startsWith('device:')) {
          console.log('Device event received:', event.type)
          // Reload devices and stats
          loadDevices()
          loadStats()
        }
      },
      (error) => {
        console.error('Events stream error:', error)
      }
    )
    
    // Cleanup on unmount
    return cleanup
  }, [])

  // Filter amts based on selected department
  useEffect(() => {
    if (formData.department_id) {
      const filtered = amts.filter(amt => amt.department_id === formData.department_id)
      setFilteredAmts(filtered)
    } else {
      setFilteredAmts([])
    }
  }, [formData.department_id, amts])

  const handleOpenCreateDialog = () => {
    setDeviceCategory('bab-client')
    setFormData({
      asset_tag: '',
      inventory_number: '',
      device_type: '',
      model: '',
      windows_version: '',
      location_id: '1',
      department_id: null,
      amt_id: null,
      notes: '',
    })
    setCreateDialogOpen(true)
  }

  const validateDeviceForm = () => {
    if (deviceCategory === 'bab-client') {
      // BAB-Client Validierung
      if (!formData.asset_tag) {
        setValidationError('Bitte Asset-Tag eingeben')
        return false
      }
      if (!formData.inventory_number) {
        setValidationError('Bitte CM-Nummer eingeben')
        return false
      }
      if (!formData.device_type) {
        setValidationError('Bitte Kategorie eingeben')
        return false
      }
      if (!formData.model) {
        setValidationError('Bitte Model eingeben')
        return false
      }
      if (!formData.windows_version) {
        setValidationError('Bitte Windows Version eingeben')
        return false
      }
      if (!formData.location_id) {
        setValidationError('Bitte Location auswählen')
        return false
      }
      if (!formData.department_id) {
        setValidationError('Bitte Department auswählen')
        return false
      }
      if (!formData.amt_id) {
        setValidationError('Bitte Amt auswählen')
        return false
      }
    } else {
      // Sonstige Validierung
      if (!formData.device_type) {
        setValidationError('Bitte Gerätetyp auswählen')
        return false
      }
      if (!formData.manufacturer) {
        setValidationError('Bitte Marke eingeben')
        return false
      }
      if (!formData.model) {
        setValidationError('Bitte Modell eingeben')
        return false
      }
    }
    setValidationError(null)
    return true
  }

  const handleCreateDevice = async () => {
    if (!validateDeviceForm()) {
      return
    }
    
    try {
      const response = await fetch('http://localhost:5001/api/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          location_id: parseInt(formData.location_id),
          department_id: formData.department_id ? parseInt(formData.department_id) : null,
          amt_id: formData.amt_id ? parseInt(formData.amt_id) : null,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create device')
      }
      
      setCreateDialogOpen(false)
      setValidationError(null)
      setFormData({
        asset_tag: '',
        inventory_number: '',
        device_type: '',
        model: '',
        windows_version: '',
        location_id: '1',
        department_id: null,
        amt_id: null,
        notes: '',
      })
      await loadData()
    } catch (err) {
      setValidationError(err.message)
    }
  }

  const handleEditDevice = (device) => {
    setDeviceToEdit(device)
    setFormData({
      asset_tag: device.asset_tag || '',
      inventory_number: device.inventory_number || '',
      device_type: device.device_type || '',
      model: device.model || '',
      windows_version: device.windows_version || '',
      location_id: String(device.location_id || 1),
      department_id: device.department_id || null,
      amt_id: device.amt_id || null,
      notes: device.notes || '',
    })
    setEditDialogOpen(true)
  }

  const handleEditConfirm = async () => {
    if (!deviceToEdit) return
    
    try {
      const updateData = {
        device_type: formData.device_type,
        manufacturer: formData.manufacturer,
        model: formData.model,
        serial_number: formData.serial_number,
        inventory_number: formData.inventory_number,
        location_id: parseInt(formData.location_id),
        department_id: formData.department_id ? parseInt(formData.department_id) : null,
        amt_id: formData.amt_id ? parseInt(formData.amt_id) : null,
        notes: formData.notes,
      }
      console.log('Updating device with data:', updateData)
      
      const response = await fetch(`http://localhost:5001/api/devices/${deviceToEdit.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Fehler beim Aktualisieren')
      }
      
      // Reload devices to get updated data
      await loadDevices()
      
      setEditDialogOpen(false)
      setDeviceToEdit(null)
      // Reset formData
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

  const handleBorrowDevice = async (deviceId) => {
    const borrowData = {
      borrower_name: 'Test User',
      borrower_email: 'test@example.com',
      borrower_phone: '+41 12 345 67 89',
      expected_return_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    }

    try {
      const response = await fetch(`http://localhost:5001/api/devices/${deviceId}/borrow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(borrowData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to borrow device')
      }
      
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleReturnDevice = async (deviceId) => {
    try {
      const response = await fetch(`http://localhost:5001/api/devices/${deviceId}/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ notes: 'Returned via UI' }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to return device')
      }
      
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteDevice = (device) => {
    setDeviceToDelete(device)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deviceToDelete) return
    
    try {
      const response = await fetch(`http://localhost:5001/api/devices/${deviceToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Fehler beim Löschen des Geräts')
      }
      
      setDeleteDialogOpen(false)
      setDeviceToDelete(null)
      await loadData()
    } catch (err) {
      setError(err.message)
      setDeleteDialogOpen(false)
    }
  }

  const getStatusBadge = (status) => {
    const colors = {
      available: 'success',
      borrowed: 'warning',
      reserved: 'informative',
    }
    return (
      <Badge appearance="filled" color={colors[status] || 'subtle'} className={styles.statusBadge}>
        {status}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Spinner size="large" label="Loading devices..." />
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className={styles.container}>
        <MessageBar intent="error">
          <MessageBarBody>
            <strong>Authentication Required:</strong> Please login first. Use the test credentials:
            <br />
            Username: <code>admin</code> / Password: <code>admin123</code>
            <br />
            <Button 
              appearance="primary" 
              style={{ marginTop: tokens.spacingVerticalM }}
              onClick={async () => {
                try {
                  console.log('Attempting login...')
                  const response = await fetch('http://localhost:5001/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
                  })
                  console.log('Login response:', response.status)
                  
                  if (response.ok) {
                    const data = await response.json()
                    console.log('Login successful:', data)
                    setError(null)
                    await loadData()
                  } else {
                    const errorData = await response.json()
                    console.error('Login failed:', errorData)
                    setError(`Login failed: ${errorData.error || response.statusText}`)
                  }
                } catch (err) {
                  console.error('Login error:', err)
                  setError(`Login error: ${err.message}`)
                }
              }}
            >
              Login as Admin
            </Button>
          </MessageBarBody>
        </MessageBar>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>Geräte verwalten</h1>
        </div>
        <div className={styles.actions}>
          <Button
            appearance="secondary"
            icon={<ArrowSync24Regular />}
            onClick={loadData}
          >
            Refresh
          </Button>
          <Button 
            appearance="primary" 
            icon={<Add24Regular />}
            onClick={handleOpenCreateDialog}
            disabled={!canEditDevices}
            title={!canEditDevices ? "Nur Editor, Redakteur oder Admin können Geräte erstellen" : ""}
          >
            Add Device
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={(_, data) => {
            setCreateDialogOpen(data.open)
            if (data.open) setValidationError(null)
          }}>
            <DialogSurface>
              <DialogBody>
                <DialogTitle>Add New Device</DialogTitle>
                <DialogContent>
                  {validationError && (
                    <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalM }}>
                      <MessageBarBody>{validationError}</MessageBarBody>
                    </MessageBar>
                  )}
                  
                  <Field label="Gerätetyp wählen" className={styles.boldLabel}>
                    <RadioGroup
                      value={deviceCategory}
                      onChange={(_, data) => setDeviceCategory(data.value)}
                      className={styles.radioGroup}
                    >
                      <Radio value="bab-client" label="BAB-Client" />
                      <Radio value="sonstige" label="Sonstige" />
                    </RadioGroup>
                  </Field>

                  <div className={styles.formGrid} style={{ marginTop: tokens.spacingVerticalM }} style={{ marginTop: tokens.spacingVerticalM }}>
                    {deviceCategory === 'bab-client' ? (
                      // BAB-Client Felder
                      <>
                        <Field label="Asset-Tag" required>
                          <Input
                            value={formData.asset_tag}
                            onChange={(e) => setFormData({ ...formData, asset_tag: e.target.value })}
                            placeholder="Asset-Tag eingeben oder scannen"
                          />
                        </Field>
                        <Field label="CM-Nummer" required>
                          <Input
                            value={formData.inventory_number}
                            onChange={(e) => setFormData({ ...formData, inventory_number: e.target.value })}
                            placeholder="CM-Nummer"
                          />
                        </Field>
                        <Field label="Kategorie" required>
                          <Input
                            value={formData.device_type}
                            onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}
                            placeholder="z.B. Laptop, Beamer"
                          />
                        </Field>
                        <Field label="Model" required>
                          <Input
                            value={formData.model}
                            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                            placeholder="z.B. Dell Latitude 7490"
                          />
                        </Field>
                        <Field label="Windows Version" required>
                          <Input
                            value={formData.windows_version}
                            onChange={(e) => setFormData({ ...formData, windows_version: e.target.value })}
                            placeholder="z.B. Windows 11 Pro"
                          />
                        </Field>
                        <Field label="Location" required>
                          <Dropdown
                            placeholder="Select location"
                            value={locations.find(l => l.id === parseInt(formData.location_id))?.name || ''}
                            onOptionSelect={(_, data) => setFormData({ ...formData, location_id: data.optionValue })}
                          >
                            {locations.map(loc => (
                              <Option key={loc.id} value={loc.id.toString()}>{loc.name}</Option>
                            ))}
                          </Dropdown>
                        </Field>
                        <Field label="Department" required>
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
                        <Field label="Amt" required disabled={!formData.department_id}>
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
                        <div className={styles.fullWidth}>
                          <div className={styles.extraInfoLabel}>Zusatz Info:</div>
                          <textarea
                            className={styles.textarea}
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Zusätzliche Informationen..."
                          />
                        </div>
                      </>
                    ) : (
                      // Sonstige Felder
                      <>
                        <Field label="Gerätetyp" required>
                          <Dropdown
                            placeholder="Wählen Sie ein Peripheriegerät"
                            value={peripherals.find(p => p.name === formData.device_type)?.name || ''}
                            onOptionSelect={(_, data) => setFormData({ ...formData, device_type: data.optionText })}
                          >
                            {peripherals.map(peripheral => (
                              <Option key={peripheral.id} value={peripheral.name}>{peripheral.name}</Option>
                            ))}
                          </Dropdown>
                        </Field>
                        <Field label="Marke" required>
                          <Input
                            value={formData.manufacturer || ''}
                            onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                            placeholder="z.B. Logitech"
                          />
                        </Field>
                        <Field label="Modell" required>
                          <Input
                            value={formData.model}
                            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                            placeholder="z.B. MX Master 3"
                          />
                        </Field>
                        <div className={styles.fullWidth}>
                          <div className={styles.extraInfoLabel}>Zusatz Info:</div>
                          <textarea
                            className={styles.textarea}
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Zusätzliche Informationen..."
                          />
                        </div>
                      </>
                    )}
                  </div>
                </DialogContent>
                <DialogActions>
                  <Button 
                    appearance="secondary"
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button appearance="primary" onClick={handleCreateDevice}>
                    Create Device
                  </Button>
                </DialogActions>
              </DialogBody>
            </DialogSurface>
          </Dialog>

          {/* Edit Device Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={(e, data) => setEditDialogOpen(data.open)}>
            <DialogSurface>
              <DialogBody>
                <DialogTitle>Gerät bearbeiten</DialogTitle>
                <DialogContent>
                  <div className={styles.formGrid}>
                    <Field label="Asset-Tag" required>
                      <Input
                        value={formData.asset_tag}
                        onChange={(e, data) =>
                          setFormData({ ...formData, asset_tag: data.value })
                        }
                      />
                    </Field>
                    <Field label="CM-Nummer">
                      <Input
                        value={formData.inventory_number}
                        onChange={(e, data) =>
                          setFormData({ ...formData, inventory_number: data.value })
                        }
                      />
                    </Field>
                    <Field label="Kategorie" required>
                      <Input
                        value={formData.device_type}
                        onChange={(e, data) =>
                          setFormData({ ...formData, device_type: data.value })
                        }
                      />
                    </Field>
                    <Field label="Model" required>
                      <Input
                        value={formData.model}
                        onChange={(e, data) =>
                          setFormData({ ...formData, model: data.value })
                        }
                      />
                    </Field>
                    <Field label="Windows Version">
                      <Input
                        value={formData.windows_version}
                        onChange={(e, data) =>
                          setFormData({ ...formData, windows_version: data.value })
                        }
                      />
                    </Field>
                    <Field label="Location" required>
                      <Dropdown
                        placeholder="Select location"
                        value={locations.find(l => l.id === parseInt(formData.location_id))?.name || ''}
                        selectedOptions={[formData.location_id?.toString()]}
                        onOptionSelect={(_, data) => setFormData({ ...formData, location_id: data.optionValue })}
                      >
                        {locations.map(loc => (
                          <Option key={loc.id} value={loc.id.toString()}>{loc.name}</Option>
                        ))}
                      </Dropdown>
                    </Field>
                    <Field label="Department">
                      <Dropdown
                        placeholder="Select department"
                        value={departments.find(d => d.id === formData.department_id)?.name || ''}
                        selectedOptions={formData.department_id ? [formData.department_id.toString()] : []}
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
                        selectedOptions={formData.amt_id ? [formData.amt_id.toString()] : []}
                        onOptionSelect={(_, data) => setFormData({ ...formData, amt_id: parseInt(data.optionValue) })}
                        disabled={!formData.department_id}
                      >
                        {filteredAmts.map(amt => (
                          <Option key={amt.id} value={amt.id.toString()}>{amt.name}</Option>
                        ))}
                      </Dropdown>
                    </Field>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div className={styles.extraInfoLabel}>Zusatz Info:</div>
                      <textarea
                        className={styles.textarea}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Zusätzliche Informationen..."
                      />
                    </div>
                  </div>
                </DialogContent>
                <DialogActions>
                  <Button
                    appearance="secondary"
                    onClick={() => setEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button appearance="primary" onClick={handleEditConfirm}>
                    Save Changes
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
                  <Text>
                    Möchten Sie das Gerät <strong>{deviceToDelete?.device_type} - {deviceToDelete?.manufacturer} {deviceToDelete?.model}</strong> wirklich löschen?
                  </Text>
                </DialogContent>
                <DialogActions>
                  <Button
                    appearance="secondary"
                    onClick={() => setDeleteDialogOpen(false)}
                  >
                    Abbrechen
                  </Button>
                  <Button 
                    appearance="primary" 
                    onClick={handleDeleteConfirm}
                    style={{ backgroundColor: tokens.colorPaletteRedBackground3 }}
                  >
                    Löschen
                  </Button>
                </DialogActions>
              </DialogBody>
            </DialogSurface>
          </Dialog>
        </div>
      </div>

      {error && (
        <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalL }}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      {stats && (
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <Text size={200}>Total Devices</Text>
            <div className={styles.statValue}>{stats.total}</div>
          </div>
          <div className={styles.statCard}>
            <Text size={200}>Available</Text>
            <div className={styles.statValue} style={{ color: tokens.colorPaletteGreenForeground1 }}>
              {stats.available}
            </div>
          </div>
          <div className={styles.statCard}>
            <Text size={200}>Borrowed</Text>
            <div className={styles.statValue} style={{ color: tokens.colorPaletteYellowForeground1 }}>
              {stats.borrowed}
            </div>
          </div>
          <div className={styles.statCard}>
            <Text size={200}>Overdue</Text>
            <div className={styles.statValue} style={{ color: tokens.colorPaletteRedForeground1 }}>
              {stats.overdue}
            </div>
          </div>
          <div className={styles.statCard}>
            <Text size={200}>Missing</Text>
            <div className={styles.statValue} style={{ color: tokens.colorNeutralForeground3 }}>
              {stats.missing}
            </div>
          </div>
        </div>
      )}

      <ResponsiveGrid>
        {filteredDevices.map((device) => {
          // Nur Felder mit Werten anzeigen
          const allFields = [
            { label: 'Asset-Tag', value: device.asset_tag },
            { label: 'Kategorie', value: device.device_type },
            { label: 'Marke', value: device.manufacturer },
            { label: 'Model', value: device.model },
            { label: 'CM-Nummer', value: device.inventory_number },
            { label: 'Windows Version', value: device.windows_version },
            { label: 'Standort', value: device.location?.name },
            { label: 'Status', value: device.status },
          ]
          
          // Filtere Felder ohne Wert heraus
          const fieldsWithValues = allFields.filter(field => field.value && field.value.trim() !== '')
          
          return (
            <AdminCard
              key={device.id}
              title={device.asset_tag || device.device_type || 'Gerät'}
              fields={fieldsWithValues}
              showInfo={true}
              detailData={device}
              onInfo={() => console.log('Device info:', device)}
              onEdit={() => handleEditDevice(device)}
              onDelete={() => handleDeleteDevice(device)}
              disableEdit={!canEditDevices}
              disableDelete={!canEditDevices}
            />
          )
        })}
      </ResponsiveGrid>
    </div>
  )
}
