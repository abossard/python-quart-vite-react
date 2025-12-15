/**
 * DepartmentList Component
 * 
 * Department management interface with CRUD operations
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Building24Regular,
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

export default function DepartmentList({ searchValue = '' }) {
  const styles = useStyles()
  const navigate = useNavigate()
  const [departments, setDepartments] = useState([])
  
  // Filter departments based on search
  const filteredDepartments = departments.filter(dept => {
    if (!searchValue) return true
    const search = searchValue.toLowerCase()
    return (
      dept.name?.toLowerCase().includes(search) ||
      dept.full_name?.toLowerCase().includes(search)
    )
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [validationError, setValidationError] = useState(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedDept, setSelectedDept] = useState(null)
  const [deptToDelete, setDeptToDelete] = useState(null)
  const [formData, setFormData] = useState({ name: '', full_name: '' })

  const loadDepartments = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/departments', {
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
      setDepartments(data)
      setAuthenticated(true)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDepartments()
    
    // Connect to real-time events
    const cleanup = connectToEventsStream(
      (event) => {
        // Reload data when department events occur
        if (event.type && event.type.startsWith('department:')) {
          console.log('Department event received:', event.type)
          loadDepartments()
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
      const response = await fetch('http://localhost:5001/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create department')
      }
      
      setCreateDialogOpen(false)
      setFormData({ name: '' })
      setValidationError(null)
      await loadDepartments()
    } catch (err) {
      setValidationError(err.message)
    }
  }

  const handleUpdate = async () => {
    if (!selectedDept) return
    
    try {
      const response = await fetch(`http://localhost:5001/api/departments/${selectedDept.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update department')
      }
      
      setEditDialogOpen(false)
      setSelectedDept(null)
      setValidationError(null)
      await loadDepartments()
    } catch (err) {
      setValidationError(err.message)
    }
  }

  const handleDeleteDepartment = (dept) => {
    setDeptToDelete(dept)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deptToDelete) return
    
    try {
      const response = await fetch(`http://localhost:5001/api/departments/${deptToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete department')
      }
      
      setDeleteDialogOpen(false)
      setDeptToDelete(null)
      await loadDepartments()
    } catch (err) {
      setError(err.message)
    }
  }

  const openEditDialog = (dept) => {
    setSelectedDept(dept)
    setFormData({ name: dept.name, full_name: dept.full_name || '' })
    setEditDialogOpen(true)
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Spinner size="large" label="Loading departments..." />
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
                    await loadDepartments()
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
        title="Departments verwalten"
        actions={[
          <Button
            key="to-amt"
            appearance="secondary"
            onClick={() => navigate('/amts')}
          >
            Zu Amt
          </Button>,
          <Dialog key="create-dialog" open={createDialogOpen} onOpenChange={(_, data) => {
            setCreateDialogOpen(data.open)
            // Reset form when dialog opens or closes
            setFormData({ name: '', full_name: '' })
            if (data.open) setValidationError(null)
          }}>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="primary" icon={<Add24Regular />} className={styles.successButton}>
                Neues Department
              </Button>
            </DialogTrigger>
            <DialogSurface>
              <DialogBody>
                <DialogTitle>Create New Department</DialogTitle>
                <DialogContent>
                  {validationError && (
                    <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalM }}>
                      <MessageBarBody>{validationError}</MessageBarBody>
                    </MessageBar>
                  )}
                  <Field label="Department Name" required>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter department name (e.g., EDI)"
                    />
                  </Field>
                  <Field label="Full Name">
                    <Input
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="Enter full name (e.g., Eidgenössisches Departement des Innern)"
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
        {filteredDepartments.map((dept) => (
          <AdminCard
            key={dept.id}
            title={dept.name}
            fields={[
              { label: 'Name', value: dept.name },
              { label: 'Vollständiger Name', value: dept.full_name || '-' },
            ]}
            onInfo={() => console.log('Info', dept)}
            onEdit={() => openEditDialog(dept)}
            onDelete={() => handleDeleteDepartment(dept)}
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
          // Reset form when dialog closes
          setFormData({ name: '', full_name: '' })
          setSelectedDept(null)
        }
      }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogContent>
              {validationError && (
                <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalM }}>
                  <MessageBarBody>{validationError}</MessageBarBody>
                </MessageBar>
              )}
              <Field label="Department Name" required>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </Field>
              <Field label="Full Name">
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
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
            <DialogTitle>Department löschen</DialogTitle>
            <DialogContent>
              <Text>
                Möchten Sie das Department <strong>{deptToDelete?.name}</strong> wirklich löschen?
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
