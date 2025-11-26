/**
 * MetricCard Component
 *
 * Reusable card displaying a key metric with optional trend indicators
 * and color-coded styling for IT support dashboard
 */

import {
  Card,
  Text,
  makeStyles,
  tokens,
  Spinner,
} from '@fluentui/react-components'
import {
  ArrowUp20Regular,
  ArrowDown20Regular,
} from '@fluentui/react-icons'

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalL,
    minHeight: '140px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: tokens.shadow8,
    },
  },
  cardGradient: {
    background: 'linear-gradient(135deg, rgba(0, 120, 212, 0.1) 0%, rgba(0, 120, 212, 0.05) 100%)',
  },
  cardSuccess: {
    background: 'linear-gradient(135deg, rgba(16, 124, 16, 0.1) 0%, rgba(16, 124, 16, 0.05) 100%)',
  },
  cardWarning: {
    background: 'linear-gradient(135deg, rgba(247, 99, 12, 0.1) 0%, rgba(247, 99, 12, 0.05) 100%)',
  },
  cardError: {
    background: 'linear-gradient(135deg, rgba(209, 52, 56, 0.1) 0%, rgba(209, 52, 56, 0.05) 100%)',
  },
  cardInfo: {
    background: 'linear-gradient(135deg, rgba(0, 120, 212, 0.1) 0%, rgba(0, 120, 212, 0.05) 100%)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalS,
  },
  icon: {
    fontSize: '24px',
    color: tokens.colorBrandForeground1,
  },
  iconSuccess: {
    color: tokens.colorPaletteGreenForeground1,
  },
  iconWarning: {
    color: tokens.colorPaletteOrangeForeground1,
  },
  iconError: {
    color: tokens.colorPaletteRedForeground1,
  },
  title: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase300,
  },
  value: {
    fontSize: '32px',
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: '1.2',
    marginBottom: tokens.spacingVerticalXS,
  },
  subtitle: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  trend: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    marginTop: tokens.spacingVerticalS,
  },
  trendUp: {
    color: tokens.colorPaletteGreenForeground1,
  },
  trendDown: {
    color: tokens.colorPaletteRedForeground1,
  },
  trendNeutral: {
    color: tokens.colorNeutralForeground3,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '140px',
  },
})

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color = 'primary',
  gradient = true,
  loading = false,
}) {
  const styles = useStyles()

  const cardColorClass = {
    primary: gradient ? styles.cardGradient : '',
    success: gradient ? styles.cardSuccess : '',
    warning: gradient ? styles.cardWarning : '',
    error: gradient ? styles.cardError : '',
    info: gradient ? styles.cardInfo : '',
  }[color]

  const iconColorClass = {
    success: styles.iconSuccess,
    warning: styles.iconWarning,
    error: styles.iconError,
  }[color] || ''

  const trendColorClass = {
    up: styles.trendUp,
    down: styles.trendDown,
    neutral: styles.trendNeutral,
  }[trend] || styles.trendNeutral

  if (loading) {
    return (
      <Card className={styles.card}>
        <div className={styles.loading}>
          <Spinner size="small" />
        </div>
      </Card>
    )
  }

  return (
    <Card className={`${styles.card} ${cardColorClass}`}>
      <div>
        <div className={styles.header}>
          {Icon && <Icon className={`${styles.icon} ${iconColorClass}`} />}
          <Text className={styles.title}>{title}</Text>
        </div>
        <Text className={styles.value}>{value}</Text>
        {subtitle && <Text className={styles.subtitle}>{subtitle}</Text>}
      </div>
      
      {trend && trendValue && (
        <div className={`${styles.trend} ${trendColorClass}`}>
          {trend === 'up' && <ArrowUp20Regular />}
          {trend === 'down' && <ArrowDown20Regular />}
          <Text size={200}>{trendValue}</Text>
        </div>
      )}
    </Card>
  )
}
