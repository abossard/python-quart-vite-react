/**
 * AppShell - Global Layout Wrapper für Grabit
 * 
 * Features:
 * - Sticky Header auf Desktop/Tablet
 * - Zentrierter Content mit max-width
 * - Logo, Navigation, Search, Hamburger Menu
 * - Footer mit Copyright
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  makeStyles,
  tokens,
  Button,
  Input,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuDivider,
  Text,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Field,
  Dropdown,
  Option,
  Spinner,
} from '@fluentui/react-components'
import {
  Navigation24Regular,
  Search24Regular,
  Dismiss24Regular,
  Location24Regular,
  SignOut24Regular,
  ArrowSwap24Regular,
} from '@fluentui/react-icons'
import { statusBackgrounds, mediaQueries } from '../theme'

const useStyles = makeStyles({
  appContainer: {
    minHeight: '100vh',
    backgroundColor: tokens.colorNeutralBackground1,
    display: 'flex',
    flexDirection: 'column',
  },
  
  header: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalXL}`,
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    boxShadow: tokens.shadow4,
    [mediaQueries.mobile]: {
      position: 'relative', // Non-sticky auf Mobile
    },
  },
  
  headerContent: {
    maxWidth: '1400px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXL,
    flexWrap: 'nowrap',
    overflow: 'hidden',
    justifyContent: 'space-between',
    [mediaQueries.mobile]: {
      gap: tokens.spacingHorizontalM,
    },
  },
  
  brandBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalL,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
    '@media (max-width: 600px)': {
      paddingRight: tokens.spacingHorizontalM,
      gap: tokens.spacingHorizontalS,
    },
  },
  
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  
  logoDesktop: {
    height: '40px',
    width: 'auto',
    display: 'block',
    [mediaQueries.mobile]: {
      display: 'none',
    },
  },
  
  logoMobile: {
    height: '40px',
    width: 'auto',
    display: 'none',
    [mediaQueries.mobile]: {
      display: 'block',
    },
  },
  
  amtsbezeichnung: {
    display: 'flex',
    flexDirection: 'column',
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightRegular,
    lineHeight: tokens.lineHeightBase100,
    color: tokens.colorNeutralForeground3,
    [mediaQueries.mobile]: {
      display: 'none', // Verstecke auf Mobile
    },
  },
  
  brandText: {
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase400,
    color: tokens.colorNeutralForeground1,
    [mediaQueries.mobile]: {
      fontSize: tokens.fontSizeBase400,
    },
  },
  
  navigation: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginLeft: 'auto',
    '@media (max-width: 1000px)': {
      display: 'none',
    },
  },
  
  navButton: {
    padding: '10px 16px',
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightRegular,
    lineHeight: tokens.lineHeightBase300,
    borderRadius: '6px',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
    transition: 'all 0.15s ease',
    cursor: 'pointer',
    color: tokens.colorNeutralForeground1,
    ':hover': {
      backgroundColor: '#0d6efd',
      color: '#ffffff',
      boxShadow: tokens.shadow8,
      borderColor: '#0d6efd',
    },
  },
  
  navButtonActive: {
    padding: '10px 16px',
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightRegular,
    lineHeight: tokens.lineHeightBase300,
    borderRadius: '6px',
    border: '1px solid #0d6efd',
    backgroundColor: '#0d6efd',
    color: '#ffffff',
    boxShadow: tokens.shadow4,
    cursor: 'pointer',
    ':hover': {
      backgroundColor: '#0d6efd',
      color: '#ffffff',
      borderColor: '#0d6efd',
    },
  },
  
  searchContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    minWidth: 0,
    '@media (max-width: 1000px)': {
      marginLeft: 'auto',
    },
  },
  
  searchWrapper: {
    minWidth: '150px',
    maxWidth: '250px',
    width: '100%',
    height: '42px',
    display: 'flex',
    alignItems: 'stretch',
    backgroundColor: '#ffffff',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderTopLeftRadius: '6px',
    borderBottomLeftRadius: '6px',
    borderRight: 'none',
    boxShadow: tokens.shadow4,
    overflow: 'hidden',
    flexShrink: 1,
  },
  
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightRegular,
    padding: '0 14px',
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    color: tokens.colorNeutralForeground1,
    '::placeholder': {
      color: tokens.colorNeutralForeground3,
    },
  },
  
  searchClearButton: {
    width: '42px',
    height: '42px',
    minWidth: '42px',
    minHeight: '42px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d6efd',
    border: '1px solid #0d6efd',
    borderTopRightRadius: '6px',
    borderBottomRightRadius: '6px',
    borderLeft: 'none',
    cursor: 'pointer',
    padding: 0,
    transition: 'background-color 0.15s ease',
    boxShadow: tokens.shadow4,
    flexShrink: 0,
    ':hover': {
      backgroundColor: '#0b5ed7',
      borderColor: '#0b5ed7',
    },
  },
  
  searchIcon: {
    color: '#ffffff',
    width: '20px',
    height: '20px',
  },
  
  hamburgerButton: {
    boxShadow: `inset 0 0 0 1px rgba(0, 0, 0, 0.2), ${tokens.shadow4}`,
    height: '42px',
    width: '42px',
    minWidth: '42px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: tokens.spacingHorizontalM,
    backgroundColor: '#ffffff',
    border: 'none',
    color: tokens.colorNeutralForeground1,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    flexShrink: 0,
    ':hover': {
      backgroundColor: '#0d6efd',
      color: '#ffffff',
    },
  },
  
  hamburgerButtonWithBorder: {
    boxShadow: `inset 0 0 0 2px #0d6efd, ${tokens.shadow4}`,
  },
  
  hamburgerButtonActive: {
    backgroundColor: '#0d6efd',
    color: '#ffffff',
    boxShadow: `inset 0 0 0 1px #0d6efd, ${tokens.shadow4}`,
  },
  
  mainContent: {
    flex: 1,
    maxWidth: '1400px',
    width: '100%',
    margin: '0 auto',
    padding: `${tokens.spacingVerticalXXXL} ${tokens.spacingHorizontalXL}`,
    [mediaQueries.mobile]: {
      padding: `${tokens.spacingVerticalXL} ${tokens.spacingHorizontalM}`,
    },
  },
  
  footer: {
    textAlign: 'center',
    padding: `${tokens.spacingVerticalXL} ${tokens.spacingHorizontalM}`,
    color: tokens.colorNeutralForeground3,
    fontSize: '12px',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  
  menuGreeting: {
    padding: '8px 16px',
    color: '#6c757d',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    cursor: 'default',
    pointerEvents: 'none',
  },
  
  menuLabel: {
    padding: '8px 16px',
    color: '#6c757d',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    cursor: 'default',
    pointerEvents: 'none',
    borderTop: '1px solid #d2d2d2',
    marginTop: '8px',
  },
  
  menuItemBase: {
    padding: '10px 16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightRegular,
    lineHeight: tokens.lineHeightBase300,
    border: 'none',
    backgroundColor: 'transparent',
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: '#0d6efd',
      color: '#ffffff',
    },
  },
  
  menuItemActive: {
    backgroundColor: '#0d6efd',
    color: '#ffffff',
    padding: '10px 16px',
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightRegular,
    lineHeight: tokens.lineHeightBase300,
    ':hover': {
      backgroundColor: '#0d6efd',
      color: '#ffffff',
    },
  },
  
  menuItemMuted: {
    color: '#6c757d',
    padding: '10px 16px',
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightRegular,
    lineHeight: tokens.lineHeightBase300,
    display: 'flex !important',
    flexDirection: 'row !important',
    alignItems: 'center !important',
    justifyContent: 'space-between !important',
    flexWrap: 'nowrap !important',
    whiteSpace: 'nowrap',
    width: '100%',
    ':hover': {
      backgroundColor: '#0d6efd',
      color: '#ffffff',
    },
  },
  
  menuItemDanger: {
    color: '#dc3545',
    padding: '10px 16px',
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightRegular,
    lineHeight: tokens.lineHeightBase300,
    display: 'flex !important',
    flexDirection: 'row !important',
    alignItems: 'center !important',
    justifyContent: 'space-between !important',
    flexWrap: 'nowrap !important',
    whiteSpace: 'nowrap',
    width: '100%',
    ':hover': {
      backgroundColor: '#dc3545',
      color: '#ffffff',
    },
  },
  
  menuItemContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    flexWrap: 'nowrap',
  },
  
  menuDivider: {
    height: '1px',
    backgroundColor: '#d2d2d2',
    margin: '8px 0',
    border: 'none',
  },
  
  menuIcon: {
    width: '18px',
    height: '18px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
})

export default function AppShell({ children, currentPage, onNavigate }) {
  const styles = useStyles();
  const [searchValue, setSearchValue] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Load user info and locations on mount
  useEffect(() => {
    loadUserInfo()
    loadLocations()
  }, [])

  const loadUserInfo = async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        // Backend returns {user: {...}, session: {...}}
        const user = data.user || data
        console.log('AppShell: Loaded user info:', user)
        setCurrentUser(user)
        setSelectedLocation(user.location_id?.toString() || '')
        // Set global user object for route guards in App.jsx
        window.grabitUser = user
      } else {
        console.error('AppShell: Failed to load user, status:', response.status)
      }
    } catch (error) {
      console.error('AppShell: Error loading user info:', error)
    }
  }
  
  const canAccessAdmin = currentUser && ['admin', 'redakteur'].includes(currentUser.role);
  // Fallback: window.grabitUser falls currentUser noch nicht geladen ist
  // Immer Servicedesk-Restriktion, egal ob currentUser geladen ist
  let role = currentUser?.role;
  if (!role && typeof window !== 'undefined' && window.grabitUser?.role) {
    role = window.grabitUser.role;
  }
  
  console.log('AppShell: Current role:', role, 'from user:', currentUser)
  
  const isServicedesk = role === 'servicedesk';
  // Rollenbasierte Navigation
  let navItems = [];
  let adminItems = [];
  switch (role) {
    case 'servicedesk':
      navItems = [{ key: 'overview', label: 'Übersicht' }];
      adminItems = [];
      break;
    case 'user':
      navItems = [
        { key: 'overview', label: 'Übersicht' },
        { key: 'history', label: 'Verlauf' },
        { key: 'missing', label: 'Vermisst' },
        { key: 'devices', label: 'Geräte' },
      ];
      adminItems = [];
      break;
    case 'editor':
      navItems = [
        { key: 'overview', label: 'Übersicht' },
        { key: 'history', label: 'Verlauf' },
        { key: 'missing', label: 'Vermisst' },
        { key: 'devices', label: 'Geräte' },
      ];
      adminItems = []; // Editor has no admin access
      break;
    case 'redakteur':
      navItems = [
        { key: 'overview', label: 'Übersicht' },
        { key: 'history', label: 'Verlauf' },
        { key: 'missing', label: 'Vermisst' },
        { key: 'devices', label: 'Geräte' },
      ];
      adminItems = [
        { key: 'users', label: 'Benutzer' },
        { key: 'departments', label: 'Departments' },
        { key: 'amts', label: 'Ämter' },
        { key: 'locations', label: 'Standorte' },
      ];
      break;
    case 'admin':
      navItems = [
        { key: 'overview', label: 'Übersicht' },
        { key: 'history', label: 'Verlauf' },
        { key: 'missing', label: 'Vermisst' },
        { key: 'devices', label: 'Geräte' },
      ];
      adminItems = [
        { key: 'users', label: 'Benutzer' },
        { key: 'departments', label: 'Departments' },
        { key: 'amts', label: 'Ämter' },
        { key: 'locations', label: 'Standorte' },
        { key: 'logs', label: 'System Logs' },
      ];
      break;
    default:
      navItems = [{ key: 'overview', label: 'Übersicht' }];
      adminItems = [];
  }

  const loadLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      if (response.ok) {
        const data = await response.json()
        setLocations(data)
      }
    } catch (error) {
      console.error('Failed to load locations:', error)
    }
  }

  const handleLocationChange = async () => {
    if (!selectedLocation || !currentUser) return
    
    setLoading(true)
    try {
      const response = await fetch('/api/auth/update-location', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: parseInt(selectedLocation)
        })
      })
      
      if (response.ok) {
        await loadUserInfo()
        setLocationDialogOpen(false)
      } else {
        const error = await response.json()
        alert('Fehler: ' + (error.error || 'Standort konnte nicht geändert werden'))
      }
    } catch (error) {
      alert('Fehler: ' + error.message)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className={styles.appContainer}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          {/* Brand Block */}
          <div className={styles.brandBlock}>
            <div className={styles.logoContainer}>
              <img 
                src="/images/logo-desktop.png" 
                alt="Logo" 
                className={styles.logoDesktop}
              />
              <img 
                src="/images/logo-mobile.svg" 
                alt="Logo" 
                className={styles.logoMobile}
              />
            </div>
          </div>
          
          <div className={styles.brandText}>Grabit</div>
          
          {/* Navigation Pills (nur Desktop/Tablet) */}
          <nav className={styles.navigation}>
            {navItems.map((item) => (
              <button
                key={item.key}
                className={currentPage === item.key ? styles.navButtonActive : styles.navButton}
                onClick={() => onNavigate(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          
          {/* Search */}
          <div className={styles.searchContainer}>
            <div className={styles.searchWrapper}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Suche…"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
            </div>
            <button
              className={styles.searchClearButton}
              onClick={() => setSearchValue('')}
              aria-label="Suche löschen"
            >
              <Dismiss24Regular className={styles.searchIcon} />
            </button>
            
            {/* Admin Menu (Verwaltung) - visible on all screen sizes */}
            <Menu open={menuOpen} onOpenChange={(e, data) => setMenuOpen(data.open)}>
              <MenuTrigger disableButtonEnhancement>
                <button
                  className={`${styles.hamburgerButton} ${menuOpen ? styles.hamburgerButtonActive : ''} ${['users', 'departments', 'amts', 'locations', 'logs'].includes(currentPage) ? styles.hamburgerButtonWithBorder : ''}`}
                  aria-label="Verwaltungsmenü"
                >
                  <Navigation24Regular style={{ width: '20px', height: '20px' }} />
                </button>
              </MenuTrigger>
              
              <MenuPopover>
                <MenuList style={{ padding: '8px 0', minWidth: '220px' }}>
                  <div className={styles.menuGreeting}>
                    Hallo {currentUser?.first_name || currentUser?.username || 'User'}
                  </div>
                  {navItems.map((item) => (
                    <MenuItem
                      key={item.key}
                      className={currentPage === item.key ? styles.menuItemActive : styles.menuItemBase}
                      onClick={() => {
                        onNavigate(item.key);
                        setMenuOpen(false);
                      }}
                    >
                      {item.label}
                    </MenuItem>
                  ))}
                  {adminItems.length > 0 && (
                    <>
                      <div className={styles.menuLabel}>Verwaltung</div>
                      {adminItems.map((item) => (
                        <MenuItem
                          key={item.key}
                          className={currentPage === item.key ? styles.menuItemActive : styles.menuItemBase}
                          onClick={() => {
                            onNavigate(item.key);
                            setMenuOpen(false);
                          }}
                        >
                          {item.label}
                        </MenuItem>
                      ))}
                      <div className={styles.menuDivider}></div>
                      <MenuItem
                        className={styles.menuItemMuted}
                        onClick={() => {
                          setSelectedLocation(currentUser?.location_id?.toString() || '');
                          setLocationDialogOpen(true);
                          setMenuOpen(false);
                        }}
                      >
                        <div className={styles.menuItemContent}>
                          <span>Standort ändern</span>
                          <ArrowSwap24Regular className={styles.menuIcon} />
                        </div>
                      </MenuItem>
                      <div className={styles.menuDivider}></div>
                    </>
                  )}
                  {/* Trennlinie vor Abmelden für User/Editor ohne Admin-Menü */}
                  {adminItems.length === 0 && (
                    <div className={styles.menuDivider}></div>
                  )}
                  {/* Abmelden immer sichtbar */}
                  <MenuItem
                    className={styles.menuItemDanger}
                    onClick={async () => {
                      try {
                        await fetch('http://localhost:5001/api/auth/logout', {
                          method: 'POST',
                          credentials: 'include',
                        });
                      } catch (error) {
                        console.error('Logout error:', error);
                      } finally {
                        window.location.href = '/login';
                      }
                    }}
                  >
                    <div className={styles.menuItemContent}>
                      <span>Abmelden</span>
                      <SignOut24Regular className={styles.menuIcon} />
                    </div>
                  </MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className={styles.mainContent}>
        {typeof children === 'function' ? children({ searchValue }) : children}
      </main>
      
      {/* Footer */}
      <footer className={styles.footer}>
        © 2025 BIT-Store
      </footer>

      {/* Standort Dialog nur für Nicht-Servicedesk */}
      {!isServicedesk && (
        <Dialog
          open={locationDialogOpen}
          onOpenChange={(event, data) => setLocationDialogOpen(data.open)}
        >
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Standort ändern</DialogTitle>
              <DialogContent>
                <Field label="Aktueller Benutzer" disabled>
                  <Input value={currentUser?.username || ''} disabled />
                </Field>
                <Field label="Standort wechseln" required>
                  <Dropdown
                    placeholder={currentUser?.location?.name || 'Standort auswählen'}
                    value={locations.find(loc => loc.id.toString() === selectedLocation)?.name || ''}
                    selectedOptions={[selectedLocation]}
                    onOptionSelect={(e, data) => setSelectedLocation(data.optionValue)}
                  >
                    {locations.map((location) => (
                      <Option key={location.id} value={location.id.toString()}>
                        {location.name}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              </DialogContent>
              <DialogActions>
                <Button appearance="secondary" onClick={() => setLocationDialogOpen(false)} disabled={loading}>
                  Abbrechen
                </Button>
                <Button appearance="primary" onClick={handleLocationChange} disabled={loading || !selectedLocation}>
                  {loading ? <Spinner size="tiny" /> : 'Speichern'}
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
    </div>
  );
}
