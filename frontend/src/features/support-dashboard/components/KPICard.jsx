/**
 * KPICard Component
 *
 * Reusable card for displaying key performance indicators
 * with icon, value, label, and optional trend
 */

import {
  Card,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components'

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalL,
    minHeight: '140px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: tokens.shadow8,
    },
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalM,
  },
  icon: {
    fontSize: '24px',
  },
  label: {
    fontSize: '14px',
    color: tokens.colorNeutralForeground2,
    fontWeight: 500,
  },
  value: {
    fontSize: '36px',
    fontWeight: 'bold',
    fontVariantNumeric: 'tabular-nums',
    marginTop: tokens.spacingVerticalS,
  },
  subtitle: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
    marginTop: tokens.spacingVerticalXS,
  },
})

export default function KPICard({ 
  icon: Icon, 
  label, 
  value, 
  subtitle,
  color = tokens.colorBrandForeground1,
  testId,
  onClick
}) {
  const styles = useStyles()

  return (
    <Card 
      className={styles.card} 
      data-testid={testId}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyPress={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          onClick()
        }
      }}
    >
      <div>
        <div className={styles.header}>
          {Icon && <Icon className={styles.icon} style={{ color }} />}
          <Text className={styles.label}>{label}</Text>
        </div>
        <div className={styles.value} style={{ color }}>
          {value}
        </div>
        {subtitle && (
          <Text className={styles.subtitle}>{subtitle}</Text>
        )}
      </div>
    </Card>
  )
}
