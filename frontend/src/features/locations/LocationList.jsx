/**
 * LocationList Component
 * 
 * Location management interface with CRUD operations
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
  Textarea,
  Text,
} from '@fluentui/react-components'
import {
  Add24Regular,
  Location24Regular,
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

export default function LocationList({ searchValue = '' }) {
  const styles = useStyles()
  const [locations, setLocations] = useState([])
  
  // Filter locations based on search
  const filteredLocations = locations.filter(location => {
    if (!searchValue) return true
    const search = searchValue.toLowerCase()
    return (
      location.name?.toLowerCase().includes(search) ||
      location.address?.toLowerCase().includes(search)
    )
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [validationError, setValidationError] = useState(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [locationToDelete, setLocationToDelete] = useState(null)
  const [formData, setFormData] = useState({ name: '', address: '' })

  const loadLocations = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/locations', {
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
      setLocations(data)
      setAuthenticated(true)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLocations()
    
    // Connect to real-time events
    const cleanup = connectToEventsStream(
      (event) => {
        // Reload data when location events occur
        if (event.type && event.type.startsWith('location:')) {
          console.log('Location event received:', event.type)
          loadLocations()
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
      const response = await fetch('http://localhost:5001/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create location')
      }
      
      setCreateDialogOpen(false)
      setFormData({ name: '', address: '' })
      setValidationError(null)
      await loadLocations()
    } catch (err) {
      setValidationError(err.message)
    }
  }

  const handleUpdate = async () => {
    if (!selectedLocation) return
    
    try {
      const response = await fetch(`http://localhost:5001/api/locations/${selectedLocation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update location')
      }
      
      setEditDialogOpen(false)
      setSelectedLocation(null)
      setValidationError(null)
      await loadLocations()
    } catch (err) {
      setValidationError(err.message)
    }
  }

  const handleDeleteLocation = (location) => {
    setLocationToDelete(location)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!locationToDelete) return
    
    try {
      const response = await fetch(`http://localhost:5001/api/locations/${locationToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete location')
      }
      
      setDeleteDialogOpen(false)
      setLocationToDelete(null)
      await loadLocations()
    } catch (err) {
      setError(err.message)
    }
  }

  const openEditDialog = (location) => {
    setSelectedLocation(location)
    setFormData({ name: location.name, address: location.address || '' })
    setEditDialogOpen(true)
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Spinner size="large" label="Loading locations..." />
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
                    await loadLocations()
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
        title="Standorte verwalten"
        actions={[
          <Dialog key="create-dialog" open={createDialogOpen} onOpenChange={(_, data) => {
            setCreateDialogOpen(data.open)
            if (data.open) {
              setFormData({ name: '', address: '' })
              setValidationError(null)
            }
          }}>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="primary" icon={<Add24Regular />} className={styles.successButton}>
                + Neuer Standort
              </Button>
            </DialogTrigger>
            <DialogSurface>
              <DialogBody>
                <DialogTitle>Create New Location</DialogTitle>
                <DialogContent>
                  {validationError && (
                    <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalM }}>
                      <MessageBarBody>{validationError}</MessageBarBody>
                    </MessageBar>
                  )}
                  <Field label="Location Name" required>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter location name (e.g., Bollwerk)"
                    />
                  </Field>
                  <Field label="Address">
                    <Textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Enter address"
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
        {filteredLocations.map((location) => (
          <AdminCard
            key={location.id}
            title={location.name}
            fields={[
              { label: 'Name', value: location.name },
              { label: 'Adresse', value: location.address || '-' },
            ]}
            onInfo={() => console.log('Info', location)}
            onEdit={() => openEditDialog(location)}
            onDelete={() => handleDeleteLocation(location)}
          />
        ))}
      </ResponsiveGrid>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(_, data) => {
        setEditDialogOpen(data.open)
        if (data.open) setValidationError(null)
      }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Edit Location</DialogTitle>
            <DialogContent>
              {validationError && (
                <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalM }}>
                  <MessageBarBody>{validationError}</MessageBarBody>
                </MessageBar>
              )}
              <Field label="Location Name" required>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </Field>
              <Field label="Address">
                <Textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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
            <DialogTitle>Standort löschen</DialogTitle>
            <DialogContent>
              <Text>
                Möchten Sie den Standort <strong>{locationToDelete?.name}</strong> wirklich löschen?
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
