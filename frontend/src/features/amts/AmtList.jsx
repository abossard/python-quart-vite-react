/**
 * AmtList Component
 * 
 * Amt management interface with CRUD operations
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
  Dropdown,
  Option,
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
  Organization24Regular,
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
  const [selectedAmt, setSelectedAmt] = useState(null)
  const [formData, setFormData] = useState({ name: '', department_id: null })

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
      setFormData({ name: '', department_id: null })
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

  const handleDelete = async (amtId) => {
    if (!confirm('Are you sure you want to delete this amt?')) return
    
    try {
      const response = await fetch(`http://localhost:5001/api/amts/${amtId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete amt')
      }
      
      await loadAmts()
    } catch (err) {
      setError(err.message)
    }
  }

  const openEditDialog = (amt) => {
    setSelectedAmt(amt)
    setFormData({ name: amt.name, department_id: amt.department_id })
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
      <div className={styles.header}>
        <div>
          <Title3>Ämter verwalten</Title3>
        </div>
        <div className={styles.actions}>
          <Button
            appearance="secondary"
            onClick={() => window.location.href = '/#/departments'}
          >
            Zu Department
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={(_, data) => setCreateDialogOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="primary" icon={<Add24Regular />}>
                + Neues Amt
              </Button>
            </DialogTrigger>
            <DialogSurface>
              <DialogBody>
                <DialogTitle>Create New Amt</DialogTitle>
                <DialogContent>
                  <Field label="Amt Name" required>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter amt name"
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
          </Dialog>
        </div>
      </div>

      {error && (
        <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalL }}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      <div className={styles.gridContainer}>
        {amts.map((amt) => (
          <Card key={amt.id} className={styles.card}>
            <CardHeader
              header={
                <div className={styles.cardContent}>
                  <div>
                    <Text weight="semibold" size={500}>{amt.department?.name || '-'} / {amt.name}</Text>
                    <div style={{ marginTop: tokens.spacingVerticalXS }}>
                      <Text size={300}>Department: {amt.department?.full_name || '-'}</Text>
                      <br />
                      <Text size={300}>Amt: {amt.name}</Text>
                    </div>
                  </div>
                  <Menu>
                    <MenuTrigger disableButtonEnhancement>
                      <Button appearance="subtle" icon={<MoreVertical24Regular />} />
                    </MenuTrigger>
                    <MenuPopover>
                      <MenuList>
                        <MenuItem icon={<Edit24Regular />} onClick={() => openEditDialog(amt)}>
                          Edit
                        </MenuItem>
                        <MenuItem icon={<Delete24Regular />} onClick={() => handleDelete(amt.id)}>
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
            <DialogTitle>Edit Amt</DialogTitle>
            <DialogContent>
              <Field label="Amt Name" required>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
    </div>
  )
}
