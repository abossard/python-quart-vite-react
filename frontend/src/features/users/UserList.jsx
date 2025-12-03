/**
 * UserList Component
 * 
 * User management interface with CRUD operations
 * Demonstrates role-based access control and admin features
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
  Location24Regular,
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
  userCard: {
    marginBottom: tokens.spacingVerticalM,
  },
  roleBadge: {
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
  userInfo: {
    display: 'flex',
    gap: tokens.spacingHorizontalL,
    alignItems: 'center',
  },
  userDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
})

export default function UserList() {
  const styles = useStyles()
  const [users, setUsers] = useState([])
  const [locations, setLocations] = useState([])
  const [departments, setDepartments] = useState([])
  const [amts, setAmts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'user',
    location_id: null,
    department_id: null,
    amt_id: null,
  })

  const roleColors = {
    admin: 'danger',
    redakteur: 'important',
    editor: 'warning',
    user: 'success',
    servicedesk: 'informative',
  }

  const loadUsers = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/users', {
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
      setUsers(data)
      setAuthenticated(true)
      setError(null)
    } catch (err) {
      setError(err.message)
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

  const loadReferenceData = async () => {
    try {
      // Load locations, departments, and amts
      const [locResponse, deptResponse, amtResponse] = await Promise.all([
        fetch('http://localhost:5001/api/devices/stats/locations', { credentials: 'include' }),
        fetch('http://localhost:5001/api/devices/stats/locations', { credentials: 'include' }),
        fetch('http://localhost:5001/api/devices/stats/locations', { credentials: 'include' }),
      ])
      
      // For now, hardcode the reference data since we don't have dedicated endpoints
      setLocations([
        { id: 1, name: 'Bollwerk' },
        { id: 2, name: 'Zollikofen' },
        { id: 3, name: 'Guisanplatz' },
      ])
      setDepartments([
        { id: 1, name: 'EDI' },
        { id: 2, name: 'EFD' },
        { id: 3, name: 'EJPD' },
      ])
      setAmts([
        { id: 1, name: 'BIT' },
        { id: 2, name: 'BAG' },
        { id: 3, name: 'BSV' },
      ])
    } catch (err) {
      console.error('Failed to load reference data:', err)
    }
  }

  const loadData = async () => {
    setLoading(true)
    await Promise.all([loadUsers(), loadCurrentUser(), loadReferenceData()])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateUser = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create user')
      }
      
      setCreateDialogOpen(false)
      setFormData({
        username: '',
        password: '',
        role: 'user',
        location_id: null,
        department_id: null,
        amt_id: null,
      })
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleUpdateUser = async () => {
    if (!selectedUser) return
    
    try {
      const updateData = { ...formData }
      delete updateData.password // Don't send empty password
      if (formData.password) {
        updateData.password = formData.password
      }
      
      const response = await fetch(`http://localhost:5001/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update user')
      }
      
      setEditDialogOpen(false)
      setSelectedUser(null)
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return
    
    try {
      const response = await fetch(`http://localhost:5001/api/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete user')
      }
      
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleChangeLocation = async () => {
    if (!selectedUser || !formData.location_id) return
    
    try {
      const response = await fetch(`http://localhost:5001/api/users/${selectedUser.id}/change-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ location_id: formData.location_id }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to change location')
      }
      
      setLocationDialogOpen(false)
      setSelectedUser(null)
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const openEditDialog = (user) => {
    setSelectedUser(user)
    setFormData({
      username: user.username,
      password: '',
      role: user.role,
      location_id: user.location_id,
      department_id: user.department_id,
      amt_id: user.amt_id,
    })
    setEditDialogOpen(true)
  }

  const openLocationDialog = (user) => {
    setSelectedUser(user)
    setFormData({ ...formData, location_id: user.location_id })
    setLocationDialogOpen(true)
  }

  const getRoleBadge = (role) => {
    return (
      <Badge appearance="filled" color={roleColors[role] || 'subtle'} className={styles.roleBadge}>
        {role}
      </Badge>
    )
  }

  const isAdmin = currentUser?.role === 'admin'

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Spinner size="large" label="Loading users..." />
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
                    await loadData()
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
          <Title3>Benutzer verwalten</Title3>
        </div>
        <div className={styles.actions}>
          <Button
            appearance="secondary"
            icon={<ArrowSync24Regular />}
            onClick={loadData}
          >
            Refresh
          </Button>
          {isAdmin && (
            <Dialog open={createDialogOpen} onOpenChange={(_, data) => setCreateDialogOpen(data.open)}>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="primary" icon={<Add24Regular />}>
                  Add User
                </Button>
              </DialogTrigger>
              <DialogSurface>
                <DialogBody>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogContent>
                    <div className={styles.formGrid}>
                      <Field label="Username" required className={styles.fullWidth}>
                        <Input
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          placeholder="Enter username"
                        />
                      </Field>
                      <Field label="Password" required className={styles.fullWidth}>
                        <Input
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="Enter password"
                        />
                      </Field>
                      <Field label="Role" required>
                        <Dropdown
                          value={formData.role}
                          onOptionSelect={(_, data) => setFormData({ ...formData, role: data.optionValue })}
                        >
                          <Option value="servicedesk">Servicedesk</Option>
                          <Option value="user">User</Option>
                          <Option value="editor">Editor</Option>
                          <Option value="redakteur">Redakteur</Option>
                          <Option value="admin">Admin</Option>
                        </Dropdown>
                      </Field>
                      <Field label="Location">
                        <Dropdown
                          placeholder="Select location"
                          value={locations.find(l => l.id === formData.location_id)?.name || ''}
                          onOptionSelect={(_, data) => setFormData({ ...formData, location_id: parseInt(data.optionValue) })}
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
                          onOptionSelect={(_, data) => setFormData({ ...formData, department_id: parseInt(data.optionValue) })}
                        >
                          {departments.map(dept => (
                            <Option key={dept.id} value={dept.id.toString()}>{dept.name}</Option>
                          ))}
                        </Dropdown>
                      </Field>
                      <Field label="Amt">
                        <Dropdown
                          placeholder="Select amt"
                          value={amts.find(a => a.id === formData.amt_id)?.name || ''}
                          onOptionSelect={(_, data) => setFormData({ ...formData, amt_id: parseInt(data.optionValue) })}
                        >
                          {amts.map(amt => (
                            <Option key={amt.id} value={amt.id.toString()}>{amt.name}</Option>
                          ))}
                        </Dropdown>
                      </Field>
                    </div>
                  </DialogContent>
                  <DialogActions>
                    <DialogTrigger disableButtonEnhancement>
                      <Button appearance="secondary">Cancel</Button>
                    </DialogTrigger>
                    <Button appearance="primary" onClick={handleCreateUser}>
                      Create User
                    </Button>
                  </DialogActions>
                </DialogBody>
              </DialogSurface>
            </Dialog>
          )}
        </div>
      </div>

      {error && (
        <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalL }}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      <div className={styles.gridContainer}>
        {users.map((user) => (
          <Card key={user.id} className={styles.userCard}>
            <CardHeader
              header={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div className={styles.userInfo}>
                    <div className={styles.userDetails}>
                      <Text weight="semibold" size={400}>{user.username}</Text>
                      <div style={{ display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'center' }}>
                        {getRoleBadge(user.role)}
                        {user.location && (
                          <Text size={200}>
                            <Location24Regular style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                            {user.location.name}
                          </Text>
                        )}
                        {user.department && (
                          <Text size={200}>Dept: {user.department.name}</Text>
                        )}
                        {user.amt && (
                          <Text size={200}>Amt: {user.amt.name}</Text>
                        )}
                      </div>
                      <Text size={200}>Created: {new Date(user.created_at).toLocaleDateString()}</Text>
                    </div>
                  </div>
                  {isAdmin && (
                    <Menu>
                      <MenuTrigger disableButtonEnhancement>
                        <Button appearance="subtle" icon={<MoreVertical24Regular />} />
                      </MenuTrigger>
                      <MenuPopover>
                        <MenuList>
                          <MenuItem icon={<Edit24Regular />} onClick={() => openEditDialog(user)}>
                            Edit User
                          </MenuItem>
                          <MenuItem icon={<Location24Regular />} onClick={() => openLocationDialog(user)}>
                            Change Location
                          </MenuItem>
                          <MenuItem
                            icon={<Delete24Regular />}
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={user.id === currentUser?.id}
                          >
                            Delete User
                          </MenuItem>
                        </MenuList>
                      </MenuPopover>
                    </Menu>
                  )}
                </div>
              }
            />
          </Card>
        ))}
      </div>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(_, data) => setEditDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Edit User</DialogTitle>
            <DialogContent>
              <div className={styles.formGrid}>
                <Field label="Username" required className={styles.fullWidth}>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </Field>
                <Field label="New Password (leave empty to keep current)" className={styles.fullWidth}>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter new password or leave empty"
                  />
                </Field>
                <Field label="Role" required>
                  <Dropdown
                    value={formData.role}
                    onOptionSelect={(_, data) => setFormData({ ...formData, role: data.optionValue })}
                  >
                    <Option value="servicedesk">Servicedesk</Option>
                    <Option value="user">User</Option>
                    <Option value="editor">Editor</Option>
                    <Option value="redakteur">Redakteur</Option>
                    <Option value="admin">Admin</Option>
                  </Dropdown>
                </Field>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button appearance="primary" onClick={handleUpdateUser}>
                Save Changes
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Change Location Dialog */}
      <Dialog open={locationDialogOpen} onOpenChange={(_, data) => setLocationDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Change User Location</DialogTitle>
            <DialogContent>
              <Field label="New Location" required>
                <Dropdown
                  value={locations.find(l => l.id === formData.location_id)?.name || ''}
                  onOptionSelect={(_, data) => setFormData({ ...formData, location_id: parseInt(data.optionValue) })}
                >
                  {locations.map(loc => (
                    <Option key={loc.id} value={loc.id.toString()}>{loc.name}</Option>
                  ))}
                </Dropdown>
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setLocationDialogOpen(false)}>
                Cancel
              </Button>
              <Button appearance="primary" onClick={handleChangeLocation}>
                Change Location
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  )
}
