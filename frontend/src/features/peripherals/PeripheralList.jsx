/**
 * PeripheralList Component
 * 
 * Peripheral management interface with CRUD operations
 * Access: Editor, Redakteur, and Admin can create/edit/delete
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
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px',
  },
  successButton: {
    backgroundColor: tokens.colorPaletteGreenBackground3,
    color: '#FFFFFF',
    ':hover': {
      backgroundColor: tokens.colorPaletteGreenBackground2,
    },
  },
})

export default function PeripheralList({ searchValue = '' }) {
  const styles = useStyles()
  const [peripherals, setPeripherals] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  
  // Check if user can edit peripherals (editor, redakteur, admin)
  const canEditPeripherals = currentUser && ['editor', 'redakteur', 'admin'].includes(currentUser.role)
  
  // Filter peripherals based on search
  const filteredPeripherals = peripherals.filter(peripheral => {
    if (!searchValue) return true
    const search = searchValue.toLowerCase()
    return peripheral.name?.toLowerCase().includes(search)
  })
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [validationError, setValidationError] = useState(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedPeripheral, setSelectedPeripheral] = useState(null)
  const [peripheralToDelete, setPeripheralToDelete] = useState(null)
  const [formData, setFormData] = useState({ name: '' })

  const loadPeripherals = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/peripherals', {
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
      setPeripherals(data)
      setAuthenticated(true)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadCurrentUser = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/auth/me', {
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        setCurrentUser(data.user)
      }
    } catch (err) {
      console.error('Failed to load current user:', err)
    }
  }

  useEffect(() => {
    loadPeripherals()
    loadCurrentUser()
    
    // Connect to real-time events
    const cleanup = connectToEventsStream(
      (event) => {
        // Reload data when peripheral events occur
        if (event.type && event.type.startsWith('peripheral:')) {
          console.log('Peripheral event received:', event.type)
          loadPeripherals()
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
      const response = await fetch('http://localhost:5001/api/peripherals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create peripheral')
      }
      
      setCreateDialogOpen(false)
      setFormData({ name: '' })
      setValidationError(null)
      await loadPeripherals()
    } catch (err) {
      setValidationError(err.message)
    }
  }

  const handleUpdate = async () => {
    if (!selectedPeripheral) return
    
    try {
      const response = await fetch(`http://localhost:5001/api/peripherals/${selectedPeripheral.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update peripheral')
      }
      
      setEditDialogOpen(false)
      setSelectedPeripheral(null)
      setValidationError(null)
      await loadPeripherals()
    } catch (err) {
      setValidationError(err.message)
    }
  }

  const handleDeletePeripheral = (peripheral) => {
    setPeripheralToDelete(peripheral)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!peripheralToDelete) return
    
    try {
      const response = await fetch(`http://localhost:5001/api/peripherals/${peripheralToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete peripheral')
      }
      
      setDeleteDialogOpen(false)
      setPeripheralToDelete(null)
      await loadPeripherals()
    } catch (err) {
      setError(err.message)
    }
  }

  const openEditDialog = (peripheral) => {
    setSelectedPeripheral(peripheral)
    setFormData({ name: peripheral.name })
    setEditDialogOpen(true)
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Spinner size="large" label="Loading peripherals..." />
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
          </MessageBarBody>
        </MessageBar>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <PageHeader
        title="Peripheriegeräte verwalten"
        actions={[
          <Dialog key="create-dialog" open={createDialogOpen} onOpenChange={(_, data) => {
            setCreateDialogOpen(data.open)
            setFormData({ name: '' })
            if (data.open) setValidationError(null)
          }}>
            <DialogTrigger disableButtonEnhancement>
              <Button 
                appearance="primary" 
                icon={<Add24Regular />} 
                className={styles.successButton}
                disabled={!canEditPeripherals}
                title={!canEditPeripherals ? "Nur Editor, Redakteur oder Admin können Peripheriegeräte erstellen" : ""}
              >
                Neues Peripheriegerät
              </Button>
            </DialogTrigger>
            <DialogSurface>
              <DialogBody>
                <DialogTitle>Neues Peripheriegerät erstellen</DialogTitle>
                <DialogContent>
                  {validationError && (
                    <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalM }}>
                      <MessageBarBody>{validationError}</MessageBarBody>
                    </MessageBar>
                  )}
                  <Field label="Kürzel" required>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="z.B. Maus, Tastatur, Monitor"
                    />
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
        {filteredPeripherals.map((peripheral) => (
          <AdminCard
            key={peripheral.id}
            title={peripheral.name}
            fields={[
              { label: 'Kürzel', value: peripheral.name },
            ]}
            onEdit={canEditPeripherals ? () => openEditDialog(peripheral) : null}
            onDelete={canEditPeripherals ? () => handleDeletePeripheral(peripheral) : null}
          />
        ))}
      </ResponsiveGrid>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(_, data) => {
        setEditDialogOpen(data.open)
        if (data.open) {
          setValidationError(null)
        }
        if (!data.open) {
          setFormData({ name: '' })
          setSelectedPeripheral(null)
        }
      }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Peripheriegerät bearbeiten</DialogTitle>
            <DialogContent>
              {validationError && (
                <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalM }}>
                  <MessageBarBody>{validationError}</MessageBarBody>
                </MessageBar>
              )}
              <Field label="Kürzel" required>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
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
            <DialogTitle>Peripheriegerät löschen</DialogTitle>
            <DialogContent>
              <Text>
                Möchten Sie das Peripheriegerät <strong>{peripheralToDelete?.name}</strong> wirklich löschen?
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
