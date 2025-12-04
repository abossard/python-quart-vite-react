/**
 * AppShell - Global Layout Wrapper für Grabit
 * 
 * Features:
 * - Sticky Header auf Desktop/Tablet
 * - Zentrierter Content mit max-width
 * - Logo, Navigation, Search, Hamburger Menu
 * - Footer mit Copyright
 */

import { useState } from 'react'
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
    [mediaQueries.mobile]: {
      flexWrap: 'wrap',
      gap: tokens.spacingHorizontalM,
    },
  },
  
  brandBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalL,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    [mediaQueries.mobile]: {
      borderRight: 'none',
      paddingRight: 0,
    },
  },
  
  logoPlaceholder: {
    width: '40px',
    height: '40px',
    backgroundColor: tokens.colorBrandBackground,
    borderRadius: tokens.borderRadiusMedium,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorNeutralForegroundOnBrand,
    fontWeight: tokens.fontWeightBold,
    fontSize: '18px',
  },
  
  amtsbezeichnung: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: '10px',
    color: tokens.colorNeutralForeground3,
    lineHeight: '1.2',
    [mediaQueries.mobile]: {
      display: 'none', // Verstecke auf Mobile
    },
  },
  
  brandText: {
    fontSize: '24px',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    [mediaQueries.mobile]: {
      fontSize: '20px',
    },
  },
  
  navigation: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flex: 1,
    [mediaQueries.mobile]: {
      display: 'none', // Verstecke auf Mobile (nur Hamburger)
    },
  },
  
  navButton: {
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
    ':hover': {
      boxShadow: tokens.shadow8,
      borderColor: tokens.colorNeutralStroke2,
    },
  },
  
  navButtonActive: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    borderColor: tokens.colorBrandBackground,
    ':hover': {
      backgroundColor: tokens.colorBrandBackgroundHover,
    },
  },
  
  searchContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    [mediaQueries.mobile]: {
      flex: 1,
      order: 3,
      width: '100%',
    },
  },
  
  searchInput: {
    minWidth: '250px',
    [mediaQueries.mobile]: {
      minWidth: 'auto',
      flex: 1,
    },
  },
  
  hamburgerButton: {
    boxShadow: tokens.shadow8,
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
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    color: tokens.colorNeutralForeground3,
    fontSize: '12px',
  },
  
  menuLabel: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    color: tokens.colorNeutralForeground3,
    fontSize: '11px',
    fontWeight: tokens.fontWeightSemibold,
  },
  
  menuItemActive: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  
  menuItemDanger: {
    color: tokens.colorPaletteRedForeground1,
    ':hover': {
      backgroundColor: statusBackgrounds.dangerSubtle,
    },
  },
})

export default function AppShell({ children, currentPage, onNavigate }) {
  const styles = useStyles()
  const [searchValue, setSearchValue] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  
  const navItems = [
    { key: 'overview', label: 'Übersicht' },
    { key: 'history', label: 'Verlauf' },
    { key: 'missing', label: 'Vermisst' },
    { key: 'devices', label: 'Geräte' },
  ]
  
  const adminItems = [
    { key: 'users', label: 'Benutzer' },
    { key: 'departments', label: 'Departments' },
    { key: 'amts', label: 'Ämter' },
    { key: 'locations', label: 'Standorte' },
  ]
  
  return (
    <div className={styles.appContainer}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          {/* Brand Block */}
          <div className={styles.brandBlock}>
            <div className={styles.logoPlaceholder}>CH</div>
            <div className={styles.amtsbezeichnung}>
              <span>Eidgenössisches</span>
              <span>Departement für XYZ</span>
            </div>
            <div className={styles.brandText}>Grabit</div>
          </div>
          
          {/* Navigation Pills (nur Desktop/Tablet) */}
          <nav className={styles.navigation}>
            {navItems.map((item) => (
              <Button
                key={item.key}
                appearance="subtle"
                className={`${styles.navButton} ${currentPage === item.key ? styles.navButtonActive : ''}`}
                onClick={() => onNavigate(item.key)}
              >
                {item.label}
              </Button>
            ))}
          </nav>
          
          {/* Search */}
          <div className={styles.searchContainer}>
            <Input
              className={styles.searchInput}
              placeholder="Suche..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              contentBefore={<Search24Regular />}
              contentAfter={
                searchValue && (
                  <Button
                    appearance="primary"
                    size="small"
                    icon={<Dismiss24Regular />}
                    onClick={() => setSearchValue('')}
                  />
                )
              }
            />
            
            {/* Admin Menu (Verwaltung) - visible on all screen sizes */}
            <Menu open={menuOpen} onOpenChange={(e, data) => setMenuOpen(data.open)}>
              <MenuTrigger>
                <Button
                  shape="circular"
                  appearance="subtle"
                  icon={<Navigation24Regular />}
                  className={styles.hamburgerButton}
                  aria-label="Verwaltungsmenü"
                />
              </MenuTrigger>
              
              <MenuPopover>
                <div className={styles.menuLabel}>Verwaltung</div>
                <MenuList>
                  {adminItems.map((item) => (
                    <MenuItem
                      key={item.key}
                      className={currentPage === item.key ? styles.menuItemActive : ''}
                      onClick={() => {
                        onNavigate(item.key)
                        setMenuOpen(false)
                      }}
                    >
                      {item.label}
                    </MenuItem>
                  ))}
                  
                  <MenuDivider />
                  
                  <MenuItem icon={<Location24Regular />}>
                    Standort ändern
                  </MenuItem>
                  <MenuItem
                    icon={<SignOut24Regular />}
                    className={styles.menuItemDanger}
                  >
                    Abmelden
                  </MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className={styles.mainContent}>
        {children}
      </main>
      
      {/* Footer */}
      <footer className={styles.footer}>
        © 2025 BIT-Store
      </footer>
    </div>
  )
}
