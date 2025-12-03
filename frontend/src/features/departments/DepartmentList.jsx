/**
 * DepartmentList Component
 * 
 * Department management interface with CRUD operations
 */

import { useEffect, useState } from 'react'
import {
  makeStyles,
  tokens,
  Title3,
  Text,
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
  Card,
  CardHeader,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
} from '@fluentui/react-components'
import {
  Add24Regular,
  ArrowSync24Regular,
  MoreVertical24Regular,
  Edit24Regular,
  Delete24Regular,
  Building24Regular,
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
  deptInfo: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
  },
})

export default function DepartmentList() {
  const styles = useStyles()
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedDept, setSelectedDept] = useState(null)
  const [formData, setFormData] = useState({ name: '' })

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
      await loadDepartments()
    } catch (err) {
      setError(err.message)
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
      await loadDepartments()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (deptId) => {
    if (!confirm('Are you sure you want to delete this department?')) return
    
    try {
      const response = await fetch(`http://localhost:5001/api/departments/${deptId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete department')
      }
      
      await loadDepartments()
    } catch (err) {
      setError(err.message)
    }
  }

  const openEditDialog = (dept) => {
    setSelectedDept(dept)
    setFormData({ name: dept.name })
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
      <div className={styles.header}>
        <div>
          <Title3>Department Management</Title3>
          <Text>Manage departments (Departemente)</Text>
        </div>
        <div className={styles.actions}>
          <Button
            appearance="secondary"
            icon={<ArrowSync24Regular />}
            onClick={loadDepartments}
          >
            Refresh
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={(_, data) => setCreateDialogOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="primary" icon={<Add24Regular />}>
                Add Department
              </Button>
            </DialogTrigger>
            <DialogSurface>
              <DialogBody>
                <DialogTitle>Create New Department</DialogTitle>
                <DialogContent>
                  <Field label="Department Name" required>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ name: e.target.value })}
                      placeholder="Enter department name"
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
          </Dialog>
        </div>
      </div>

      {error && (
        <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalL }}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      <div className={styles.gridContainer}>
        {departments.map((dept) => (
          <Card key={dept.id} className={styles.card}>
            <CardHeader
              header={
                <div className={styles.cardContent}>
                  <div className={styles.deptInfo}>
                    <Building24Regular />
                    <Text weight="semibold" size={400}>{dept.name}</Text>
                    <Text size={200}>ID: {dept.id}</Text>
                  </div>
                  <Menu>
                    <MenuTrigger disableButtonEnhancement>
                      <Button appearance="subtle" icon={<MoreVertical24Regular />} />
                    </MenuTrigger>
                    <MenuPopover>
                      <MenuList>
                        <MenuItem icon={<Edit24Regular />} onClick={() => openEditDialog(dept)}>
                          Edit
                        </MenuItem>
                        <MenuItem icon={<Delete24Regular />} onClick={() => handleDelete(dept.id)}>
                          Delete
                        </MenuItem>
                      </MenuList>
                    </MenuPopover>
                  </Menu>
                </div>
              }
            />
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(_, data) => setEditDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogContent>
              <Field label="Department Name" required>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ name: e.target.value })}
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
    </div>
  )
}
