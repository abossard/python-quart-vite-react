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
  RadioGroup,
  Radio,
} from '@fluentui/react-components'
import {
  Add24Regular,
  ArrowSync24Regular,
  MoreVertical24Regular,
  Edit24Regular,
  Delete24Regular,
  Location24Regular,
} from '@fluentui/react-icons'
import { connectToEventsStream } from '../../services/api'
import AdminCard from '../../components/AdminCard'
import ResponsiveGrid from '../../components/ResponsiveGrid'
import PageHeader from '../../components/PageHeader'
import AdmindirSearch from '../../components/AdmindirSearch'

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

export default function UserList({ searchValue = '' }) {
  const styles = useStyles()
  const [users, setUsers] = useState([])
  const [locations, setLocations] = useState([])
  const [departments, setDepartments] = useState([])
  const [amts, setAmts] = useState([])
  
  // Filter users based on search
  const filteredUsers = users.filter(user => {
    if (!searchValue) return true
    const search = searchValue.toLowerCase()
    return (
      user.username?.toLowerCase().includes(search) ||
      user.first_name?.toLowerCase().includes(search) ||
      user.last_name?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search) ||
      user.role?.toLowerCase().includes(search) ||
      user.location?.name?.toLowerCase().includes(search) ||
      user.department?.toLowerCase().includes(search) ||
      user.amt?.toLowerCase().includes(search)
    )
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [userToDelete, setUserToDelete] = useState(null)
  const [admindirDataLoaded, setAdmindirDataLoaded] = useState(false)
  const [validationError, setValidationError] = useState(null)
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role: 'user',
    hasLocation: 'without', // 'with' or 'without'
    location_id: null,
    department_id: null,
    amt_id: null,
    department: '',
    amt: '',
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
    
    // Connect to real-time events
    const cleanup = connectToEventsStream(
      (event) => {
        // Reload data when user events occur
        if (event.type && event.type.startsWith('user:')) {
          console.log('User event received:', event.type)
          loadUsers()
        }
      },
      (error) => {
        console.error('Events stream error:', error)
      }
    )
    
    // Cleanup on unmount
    return cleanup
  }, [])

  const validateForm = () => {
    if (!formData.username) {
      setValidationError('Bitte Benutzername eingeben (verwenden Sie die Admindir-Suche)')
      return false
    }
    if (!formData.first_name) {
      setValidationError('Bitte Vorname eingeben (verwenden Sie die Admindir-Suche)')
      return false
    }
    if (!formData.last_name) {
      setValidationError('Bitte Nachname eingeben (verwenden Sie die Admindir-Suche)')
      return false
    }
    if (!formData.email) {
      setValidationError('Bitte E-Mail eingeben (verwenden Sie die Admindir-Suche)')
      return false
    }
    if (!formData.password) {
      setValidationError('Bitte Passwort eingeben')
      return false
    }
    if (formData.hasLocation === 'with' && !formData.location_id) {
      setValidationError('Bitte Location auswählen')
      return false
    }
    setValidationError(null)
    return true
  }

  const handleCreateUser = async () => {
    if (!validateForm()) {
      return
    }
    
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
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        role: 'user',
        hasLocation: 'without',
        location_id: null,
        department_id: null,
        amt_id: null,
      })
      // Nach Create: Userinfo holen und global setzen
      try {
        const userRes = await fetch('http://localhost:5001/api/auth/me', { credentials: 'include' })
        if (userRes.ok) {
          const userData = await userRes.json()
          const user = userData.user || userData
          window.grabitUser = user
        }
      } catch (e) {
        // Fallback: ignore
      }
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
      // Nach Update: Userinfo holen und global setzen
      try {
        const userRes = await fetch('http://localhost:5001/api/auth/me', { credentials: 'include' })
        if (userRes.ok) {
          const userData = await userRes.json()
          const user = userData.user || userData
          window.grabitUser = user
        }
      } catch (e) {
        // Fallback: ignore
      }
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteUser = (user) => {
    setUserToDelete(user)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return
    
    try {
      const response = await fetch(`http://localhost:5001/api/users/${userToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete user')
      }
      
      setDeleteDialogOpen(false)
      setUserToDelete(null)
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
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      password: '',
      role: user.role,
      hasLocation: user.location_id ? 'with' : 'without',
      location_id: user.location_id,
      department_id: user.department_id,
      amt_id: user.amt_id,
      department: user.department || '',
      amt: user.amt || '',
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

  const isAdmin = currentUser?.role === 'admin';
  const isRedakteur = currentUser?.role === 'redakteur';

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
          {(isAdmin || isRedakteur) && (
            <Dialog 
              open={createDialogOpen} 
              onOpenChange={(_, data) => {
                setCreateDialogOpen(data.open)
                // Reset form when dialog is closed
                if (!data.open) {
                  setFormData({
                    username: '',
                    first_name: '',
                    last_name: '',
                    email: '',
                    password: '',
                    role: 'user',
                    hasLocation: 'without',
                    location_id: null,
                    department_id: null,
                    amt_id: null,
                    department: '',
                    amt: '',
                  })
                  setAdmindirDataLoaded(false)
                  setValidationError(null)
                }
              }}
            >              <DialogTrigger disableButtonEnhancement>
                <Button appearance="primary" icon={<Add24Regular />}>
                  Add User
                </Button>
              </DialogTrigger>
              <DialogSurface>
                <DialogBody>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogContent>
                    {validationError && (
                      <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalM }}>
                        <MessageBarBody>{validationError}</MessageBarBody>
                      </MessageBar>
                    )}
                    <div className={styles.formGrid}>
                      <Field label="Admindir Suche" hint="Suche nach Benutzern im Admindir" className={styles.fullWidth}>
                        <AdmindirSearch
                          onSelect={(person) => {
                            console.log('Selected person from admindir:', person)
                            
                            // Extract data from admindir response
                            // Handle both search result format and full person detail format
                            let firstName = ''
                            let lastName = ''
                            let email = ''
                            let username = ''
                            
                            // Parse name from new API format
                            firstName = person.firstname || ''
                            lastName = person.lastname || ''
                            
                            // Get email
                            email = person.email || ''
                            
                            // Username is already generated in AdmindirSearch component
                            // Format: first 2 letters of surname + first 2 letters of givenName
                            // Example: Alessandro Roschi -> roal
                            username = person.username || ''
                            
                            // Get department and organization from admindir
                            const department = person.department || ''
                            const amt = person.organization || ''
                            
                            setFormData({
                              ...formData,
                              username: username,
                              first_name: firstName,
                              last_name: lastName,
                              email: email,
                              department: department,
                              amt: amt,
                            })
                            setAdmindirDataLoaded(true)
                          }}
                        />
                      </Field>
                      <Field label="Username" required className={styles.fullWidth}>
                        <Input
                          value={formData.username}
                          placeholder="Use Admindir search to auto-fill"
                          disabled={true}
                        />
                      </Field>
                      <Field label="First Name" required>
                        <Input
                          value={formData.first_name}
                          placeholder="Use Admindir search to auto-fill"
                          disabled={true}
                        />
                      </Field>
                      <Field label="Last Name" required>
                        <Input
                          value={formData.last_name}
                          placeholder="Use Admindir search to auto-fill"
                          disabled={true}
                        />
                      </Field>
                      <Field label="Email" required className={styles.fullWidth}>
                        <Input
                          type="email"
                          value={formData.email}
                          placeholder="Use Admindir search to auto-fill"
                          disabled={true}
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
                          {isAdmin && <Option value="admin">Admin</Option>}
                        </Dropdown>
                      </Field>
                      <Field label="Location Zuordnung" required className={styles.fullWidth}>
                        <RadioGroup
                          value={formData.hasLocation}
                          onChange={(_, data) => setFormData({ 
                            ...formData, 
                            hasLocation: data.value,
                            location_id: data.value === 'without' ? null : formData.location_id
                          })}
                          layout="horizontal"
                        >
                          <Radio value="with" label="Mit Location" />
                          <Radio value="without" label="Ohne Location" />
                        </RadioGroup>
                      </Field>
                      <Field label="Location" className={styles.fullWidth}>
                        <Dropdown
                          placeholder="Select location"
                          value={locations.find(l => l.id === formData.location_id)?.name || ''}
                          onOptionSelect={(_, data) => setFormData({ ...formData, location_id: parseInt(data.optionValue) })}
                          disabled={formData.hasLocation === 'without'}
                        >
                          {locations.map(loc => (
                            <Option key={loc.id} value={loc.id.toString()}>{loc.name}</Option>
                          ))}
                        </Dropdown>
                      </Field>
                      <Field label="Department">
                        <Input
                          value={formData.department}
                          placeholder="Use Admindir search to auto-fill"
                          disabled={true}
                        />
                      </Field>
                      <Field label="Amt">
                        <Input
                          value={formData.amt}
                          placeholder="Use Admindir search to auto-fill"
                          disabled={true}
                        />
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

      <ResponsiveGrid>
        {filteredUsers.map((user) => {
          // Redakteur darf Admins nicht bearbeiten/löschen
          const isTargetAdmin = user.role === 'admin';
          const canEdit = (isAdmin || (isRedakteur && !isTargetAdmin));
          const canDelete = (isAdmin && user.id !== currentUser?.id) || (isRedakteur && !isTargetAdmin && user.id !== currentUser?.id);
          return (
            <AdminCard
              key={user.id}
              title={user.username}
              fields={[
                { label: 'Name', value: `${user.first_name || ''} ${user.last_name || ''}`.trim() || '-' },
                { label: 'Email', value: user.email || '-' },
                { label: 'Rolle', value: user.role },
                { label: 'Standort', value: user.location?.name || 'Alle Standorte' },
                { label: 'Department', value: user.department || '-' },
                { label: 'Amt', value: user.amt || '-' },
              ]}
              onEdit={canEdit ? () => openEditDialog(user) : null}
              onDelete={canDelete ? () => handleDeleteUser(user) : null}
            />
          );
        })}
      </ResponsiveGrid>

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
                    placeholder="Cannot be changed"
                    disabled={true}
                  />
                </Field>
                <Field label="First Name" required>
                  <Input
                    value={formData.first_name}
                    placeholder="Cannot be changed"
                    disabled={true}
                  />
                </Field>
                <Field label="Last Name" required>
                  <Input
                    value={formData.last_name}
                    placeholder="Cannot be changed"
                    disabled={true}
                  />
                </Field>
                <Field label="Email" required className={styles.fullWidth}>
                  <Input
                    type="email"
                    value={formData.email}
                    placeholder="Cannot be changed"
                    disabled={true}
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
                <Field label="Location Zuordnung" required className={styles.fullWidth}>
                  <RadioGroup
                    value={formData.hasLocation}
                    onChange={(_, data) => setFormData({ 
                      ...formData, 
                      hasLocation: data.value,
                      location_id: data.value === 'without' ? null : formData.location_id
                    })}
                    layout="horizontal"
                  >
                    <Radio value="with" label="Mit Location" />
                    <Radio value="without" label="Ohne Location" />
                  </RadioGroup>
                </Field>
                <Field label="Location" className={styles.fullWidth}>
                  <Dropdown
                    placeholder="Select location"
                    value={locations.find(l => l.id === formData.location_id)?.name || ''}
                    onOptionSelect={(_, data) => setFormData({ ...formData, location_id: parseInt(data.optionValue) })}
                    disabled={formData.hasLocation === 'without'}
                  >
                    {locations.map(loc => (
                      <Option key={loc.id} value={loc.id.toString()}>{loc.name}</Option>
                    ))}
                  </Dropdown>
                </Field>
                <Field label="Department">
                  <Input
                    value={formData.department}
                    placeholder="Cannot be changed"
                    disabled={true}
                  />
                </Field>
                <Field label="Amt">
                  <Input
                    value={formData.amt}
                    placeholder="Cannot be changed"
                    disabled={true}
                  />
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(e, data) => setDeleteDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Benutzer löschen</DialogTitle>
            <DialogContent>
              <Text>
                Möchten Sie den Benutzer <strong>{userToDelete?.username}</strong> wirklich löschen?
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
