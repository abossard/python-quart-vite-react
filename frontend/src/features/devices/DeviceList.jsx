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
  Card,
  CardHeader,
} from '@fluentui/react-components'
import {
  Add24Regular,
  ArrowSync24Regular,
  CheckmarkCircle24Regular,
  DismissCircle24Regular,
} from '@fluentui/react-icons'

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
})

export default function DeviceList() {
  const styles = useStyles()
  const [devices, setDevices] = useState([])
  const [stats, setStats] = useState(null)
  const [departments, setDepartments] = useState([])
  const [amts, setAmts] = useState([])
  const [filteredAmts, setFilteredAmts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
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

  const loadData = async () => {
    setLoading(true)
    await Promise.all([loadDevices(), loadStats(), loadDepartments(), loadAmts()])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
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

  const handleCreateDevice = async () => {
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
      await loadData()
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
          <Title3>Device Management</Title3>
          <Text>Manage your device inventory</Text>
        </div>
        <div className={styles.actions}>
          <Button
            appearance="secondary"
            icon={<ArrowSync24Regular />}
            onClick={loadData}
          >
            Refresh
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={(_, data) => setCreateDialogOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="primary" icon={<Add24Regular />}>
                Add Device
              </Button>
            </DialogTrigger>
            <DialogSurface>
              <DialogBody>
                <DialogTitle>Add New Device</DialogTitle>
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
                  <DialogTrigger disableButtonEnhancement>
                    <Button appearance="secondary">Cancel</Button>
                  </DialogTrigger>
                  <Button appearance="primary" onClick={handleCreateDevice}>
                    Create Device
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

      <div className={styles.gridContainer}>
        <div style={{ display: 'grid', gap: tokens.spacingVerticalM }}>
          {devices.map((device) => (
            <Card key={device.id}>
              <CardHeader
                header={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div>
                      <Text weight="semibold" size={400}>
                        {device.device_type} - {device.manufacturer} {device.model}
                      </Text>
                      <div style={{ marginTop: tokens.spacingVerticalXS }}>
                        <Text size={200} style={{ marginRight: tokens.spacingHorizontalM }}>
                          Serial: {device.serial_number || '-'}
                        </Text>
                        <Text size={200} style={{ marginRight: tokens.spacingHorizontalM }}>
                          Inventory: {device.inventory_number || '-'}
                        </Text>
                        <Text size={200} style={{ marginRight: tokens.spacingHorizontalM }}>
                          Location: {device.location?.name || '-'}
                        </Text>
                      </div>
                      <div style={{ marginTop: tokens.spacingVerticalXXS }}>
                        {device.department && (
                          <Text size={200} style={{ marginRight: tokens.spacingHorizontalM }}>
                            Department: {device.department.name}
                          </Text>
                        )}
                        {device.amt && (
                          <Text size={200}>
                            Amt: {device.amt.name}
                          </Text>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: tokens.spacingHorizontalM, alignItems: 'center' }}>
                      {getStatusBadge(device.status)}
                      {device.status === 'available' && (
                        <Button
                          size="small"
                          appearance="primary"
                          icon={<CheckmarkCircle24Regular />}
                          onClick={() => handleBorrowDevice(device.id)}
                        >
                          Borrow
                        </Button>
                      )}
                      {device.status === 'borrowed' && (
                        <Button
                          size="small"
                          appearance="secondary"
                          icon={<DismissCircle24Regular />}
                          onClick={() => handleReturnDevice(device.id)}
                        >
                          Return
                        </Button>
                      )}
                    </div>
                  </div>
                }
              />
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
