/**
 * AmtList Component
 * 
 * Amt management interface with CRUD operations
 */

import { useEffect, useState } from 'react'
import {
  makeStyles,
  tokens,
  Button,
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
  Text,
} from '@fluentui/react-components'
import {
  Add24Regular,
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
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
  },
  gridContainer: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    padding: tokens.spacingVerticalL,
  },
  card: {
    marginBottom: tokens.spacingVerticalM,
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px',
  },
  cardContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  amtInfo: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
  },
})

export default function AmtList() {
  const styles = useStyles()
  const [amts, setAmts] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedAmt, setSelectedAmt] = useState(null)
  const [amtToDelete, setAmtToDelete] = useState(null)
  const [formData, setFormData] = useState({ name: '', full_name: '', department_id: null })

  const loadAmts = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/amts', {
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
      setAmts(data)
      setAuthenticated(true)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
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

  useEffect(() => {
    loadAmts()
    loadDepartments()
    
    // Connect to real-time events
    const cleanup = connectToEventsStream(
      (event) => {
        // Reload data when amt or department events occur
        if (event.type && (event.type.startsWith('amt:') || event.type.startsWith('department:'))) {
          console.log('Amt/Department event received:', event.type)
          loadAmts()
          if (event.type.startsWith('department:')) {
            loadDepartments()
          }
        }
      },
      (error) => {
        console.error('Events stream error:', error)
      }
    )
    
    // Cleanup on unmount
    return cleanup
  }, [])

  const handleCreate = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/amts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create amt')
      }
      
      setCreateDialogOpen(false)
      setFormData({ name: '', full_name: '', department_id: null })
      await loadAmts()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleUpdate = async () => {
    if (!selectedAmt) return
    
    try {
      const response = await fetch(`http://localhost:5001/api/amts/${selectedAmt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update amt')
      }
      
      setEditDialogOpen(false)
      setSelectedAmt(null)
      await loadAmts()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteAmt = (amt) => {
    setAmtToDelete(amt)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!amtToDelete) return
    
    try {
      const response = await fetch(`http://localhost:5001/api/amts/${amtToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete amt')
      }
      
      setDeleteDialogOpen(false)
      setAmtToDelete(null)
      await loadAmts()
    } catch (err) {
      setError(err.message)
    }
  }

  const openEditDialog = (amt) => {
    setSelectedAmt(amt)
    setFormData({ name: amt.name, full_name: amt.full_name || '', department_id: amt.department_id })
    setEditDialogOpen(true)
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Spinner size="large" label="Loading amts..." />
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className={styles.container}>
        <MessageBar intent="error">
          <MessageBarBody>
            <strong>Authentication Required:</strong> Please login first.
            <br />
            <Button 
              appearance="primary" 
              style={{ marginTop: tokens.spacingVerticalM }}
              onClick={async () => {
                try {
                  const response = await fetch('http://localhost:5001/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
                  })
                  if (response.ok) {
                    await loadAmts()
                  }
                } catch (err) {
                  setError(err.message)
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
      <PageHeader
        title="Ämter verwalten"
        actions={[
          <Dialog key="create-dialog" open={createDialogOpen} onOpenChange={(_, data) => setCreateDialogOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
              <Button 
                appearance="primary" 
                icon={<Add24Regular />}
                style={{ backgroundColor: tokens.colorPaletteGreenBackground3, color: '#FFFFFF' }}
              >
                Neues Amt
              </Button>
            </DialogTrigger>
            <DialogSurface>
              <DialogBody>
                <DialogTitle>Neues Amt erstellen</DialogTitle>
                <DialogContent>
                  <Field label="Kürzel" required>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="z.B. BIT"
                    />
                  </Field>
                  <Field label="Ausgeschriebener Name" style={{ marginTop: tokens.spacingVerticalM }}>
                    <Input
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="z.B. Bundesamt für Informatik und Telekommunikation"
                    />
                  </Field>
                  <Field label="Department" required style={{ marginTop: tokens.spacingVerticalM }}>
                    <Dropdown
                      placeholder="Select department"
                      value={departments.find(d => d.id === formData.department_id)?.name || ''}
                      onOptionSelect={(_, data) => setFormData({ ...formData, department_id: parseInt(data.optionValue) })}
                    >
                      {departments.map(dept => (
                        <Option key={dept.id} value={dept.id.toString()}>{dept.name}</Option>
                      ))}
                    </Dropdown>
                  </Field>
                </DialogContent>
                <DialogActions>
                  <DialogTrigger disableButtonEnhancement>
                    <Button appearance="secondary">Cancel</Button>
                  </DialogTrigger>
                  <Button appearance="primary" onClick={handleCreate}>
                    Create
                  </Button>
                </DialogActions>
              </DialogBody>
            </DialogSurface>
          </Dialog>,
        ]}
      />

      {error && (
        <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalL }}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      <ResponsiveGrid>
        {amts.map((amt) => (
          <AdminCard
            key={amt.id}
            title={`${amt.department?.name || '-'} / ${amt.name}`}
            fields={[
              { label: 'Department', value: amt.department?.full_name || '-' },
              { label: 'Amt', value: amt.name },
            ]}
            onEdit={() => openEditDialog(amt)}
            onDelete={() => handleDeleteAmt(amt)}
          />
        ))}
      </ResponsiveGrid>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(_, data) => setEditDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Edit Amt</DialogTitle>
            <DialogContent>
              <Field label="Kürzel" required>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </Field>
              <Field label="Ausgeschriebener Name" style={{ marginTop: tokens.spacingVerticalM }}>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="z.B. Bundesamt für Informatik und Telekommunikation"
                />
              </Field>
              <Field label="Department" required style={{ marginTop: tokens.spacingVerticalM }}>
                <Dropdown
                  placeholder="Select department"
                  value={departments.find(d => d.id === formData.department_id)?.name || ''}
                  onOptionSelect={(_, data) => setFormData({ ...formData, department_id: parseInt(data.optionValue) })}
                >
                  {departments.map(dept => (
                    <Option key={dept.id} value={dept.id.toString()}>{dept.name}</Option>
                  ))}
                </Dropdown>
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button appearance="primary" onClick={handleUpdate}>
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
            <DialogTitle>Amt löschen</DialogTitle>
            <DialogContent>
              <Text>
                Möchten Sie das Amt <strong>{amtToDelete?.name}</strong> wirklich löschen?
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
  )
}
