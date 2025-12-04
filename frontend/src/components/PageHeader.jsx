/**
 * PageHeader - Wiederverwendbarer Seiten-Header
 * 
 * Features:
 * - H1 Titel links
 * - Action-Buttons rechts
 * - Responsive Layout
 */

import {
  makeStyles,
  tokens,
  Title1,
  Button,
} from '@fluentui/react-components'
import { mediaQueries } from '../theme'

const useStyles = makeStyles({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalXXL,
    [mediaQueries.mobile]: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: tokens.spacingVerticalL,
    },
  },
  
  title: {
    fontSize: '32px',
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
  },
  
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    [mediaQueries.mobile]: {
      width: '100%',
      flexDirection: 'column',
    },
  },
})

export default function PageHeader({ title, actions = [] }) {
  const styles = useStyles()
  
  return (
    <div className={styles.header}>
      <Title1 className={styles.title}>{title}</Title1>
      
      {actions.length > 0 && (
        <div className={styles.actions}>
          {actions}
        </div>
      )}
    </div>
  )
}
