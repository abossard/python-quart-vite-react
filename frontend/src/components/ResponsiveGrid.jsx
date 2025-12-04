/**
 * ResponsiveGrid - Grid-Layout-Komponente mit Breakpoints
 * 
 * Columns:
 * - Desktop (≥1200px): 3 oder 4 Spalten (konfigurierbar)
 * - Tablet (768-1199px): 2 Spalten
 * - Mobile (<768px): 1 Spalte
 */

import { makeStyles } from '@fluentui/react-components'
import { tokens } from '@fluentui/react-components'
import { mediaQueries } from '../theme'

const useStyles = makeStyles({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: tokens.spacingHorizontalL,
    [mediaQueries.tablet]: {
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: tokens.spacingHorizontalL,
    },
    [mediaQueries.mobile]: {
      gridTemplateColumns: '1fr',
      gap: tokens.spacingHorizontalM,
    },
  },
})

export default function ResponsiveGrid({ children }) {
  const styles = useStyles()
  
  return (
    <div className={styles.grid}>
      {children}
    </div>
  )
}
