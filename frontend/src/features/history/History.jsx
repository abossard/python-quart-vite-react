/**
 * History Component - Verlauf
 * 
 * Zeigt alle Transaktionen/Aktivitäten mit Geräten
 */

import { useEffect, useState } from 'react'
import {
  makeStyles,
  tokens,
  Spinner,
  MessageBar,
  MessageBarBody,
  Badge,
} from '@fluentui/react-components'
import {
  ArrowExportLtr24Regular,
  ArrowEnterLeft24Regular,
  Warning24Regular,
  Clock24Regular,
  ArrowUndo24Regular,
  Delete24Regular,
  Dismiss24Regular,
  Add24Regular,
  ArrowSync24Regular,
} from '@fluentui/react-icons'
import PageHeader from '../../components/PageHeader'

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalXXL,
  },
  
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  },
  
  timeline: {
    width: '100%',
  },
  
  timelineItem: {
    display: 'flex',
    gap: '24px',
    marginBottom: '32px',
    position: 'relative',
    paddingBottom: '32px',
    ':not(:last-child)::after': {
      content: '""',
      position: 'absolute',
      left: '20px',
      top: '44px',
      bottom: '0',
      width: '2px',
      backgroundColor: tokens.colorNeutralStroke2,
    },
  },
  
  timelineIcon: {
    width: '40px',
    height: '40px',
    minWidth: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `2px solid ${tokens.colorNeutralStroke2}`,
    zIndex: 1,
  },
  
  timelineIconBorrow: {
    backgroundColor: '#F8D7DA',
    borderColor: '#DC3545',
    color: '#DC3545',
  },
  
  timelineIconReturn: {
    backgroundColor: '#D1E7DD',
    borderColor: '#198754',
    color: '#198754',
  },
  
  timelineIconMissing: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFC107',
    color: '#856404',
  },
  
  timelineIconCreate: {
    backgroundColor: '#D1E7DD',
    borderColor: '#198754',
    color: '#198754',
  },
  
  timelineIconDelete: {
    backgroundColor: '#F8D7DA',
    borderColor: '#DC3545',
    color: '#DC3545',
  },
  
  timelineIconUpdate: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFC107',
    color: '#856404',
  },
  
  timelineIconFound: {
    backgroundColor: '#D1E7DD',
    borderColor: '#198754',
    color: '#198754',
  },
  
  timelineContent: {
    flex: 1,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '8px',
    padding: '18px',
    boxShadow: tokens.shadow4,
  },
  
  timelineHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
  },
  
  timelineTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: tokens.colorNeutralForeground1,
    marginBottom: '4px',
  },
  
  timelineSubtitle: {
    fontSize: '14px',
    color: tokens.colorNeutralForeground3,
  },
  
  timelineTime: {
    fontSize: '13px',
    color: tokens.colorNeutralForeground3,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  
  timelineDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  
  timelineDetail: {
    fontSize: '14px',
  },
  
  timelineDetailLabel: {
    fontWeight: '700',
    color: tokens.colorNeutralForeground2,
  },
  
  timelineDetailValue: {
    color: tokens.colorNeutralForeground1,
  },
  
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    gap: tokens.spacingVerticalL,
    color: tokens.colorNeutralForeground3,
  },
})

export default function History({ searchValue = '' }) {
  const styles = useStyles()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Filter transactions based on search
  const filteredTransactions = transactions.filter(transaction => {
    if (!searchValue) return true
    const search = searchValue.toLowerCase()
    return (
      transaction.action?.toLowerCase().includes(search) ||
      transaction.transaction_type?.toLowerCase().includes(search) ||
      transaction.device_type?.toLowerCase().includes(search) ||
      transaction.manufacturer?.toLowerCase().includes(search) ||
      transaction.model?.toLowerCase().includes(search) ||
      transaction.serial_number?.toLowerCase().includes(search) ||
      transaction.inventory_number?.toLowerCase().includes(search) ||
      transaction.user_name?.toLowerCase().includes(search) ||
      transaction.borrower_name?.toLowerCase().includes(search) ||
      transaction.location?.toLowerCase().includes(search) ||
      transaction.department?.toLowerCase().includes(search) ||
      transaction.amt?.toLowerCase().includes(search)
    )
  })

  // Mock data for demonstration
  const loadHistory = async () => {
    try {
      setLoading(true)
      
      // TODO: Replace with actual API call
      // const response = await fetch('http://localhost:5001/api/transactions', {
      //   credentials: 'include',
      // })
      
      // Mock transactions for now
      const mockTransactions = [
        {
          id: 1,
          type: 'borrow',
          device_type: 'Laptop',
          manufacturer: 'Dell',
          model: 'XPS 15',
          inventory_number: 'CM09737',
          borrower_name: 'Max Mustermann',
          location: 'Bollwerk',
          department: 'EFD',
          amt: 'BIT',
          timestamp: '2024-12-04T10:30:00',
        },
        {
          id: 2,
          type: 'return',
          device_type: 'Laptop',
          manufacturer: 'HP',
          model: 'EliteBook',
          inventory_number: 'CM09738',
          borrower_name: 'Anna Schmidt',
          location: 'Kfk',
          department: 'WBF',
          amt: 'Agroscope',
          timestamp: '2024-12-04T09:15:00',
        },
        {
          id: 3,
          type: 'missing',
          device_type: 'Tablet',
          manufacturer: 'Apple',
          model: 'iPad Pro',
          inventory_number: 'CM09739',
          borrower_name: 'Peter Müller',
          location: 'Bollwerk',
          department: 'EFD',
          amt: 'BIT',
          timestamp: '2024-12-03T16:45:00',
        },
      ]
      
      setTransactions(mockTransactions)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadHistorySmooth = async (showLoadingIndicator = true) => {
    try {
      if (showLoadingIndicator) {
        setLoading(true)
      }
      const response = await fetch('http://localhost:5001/api/transactions/history', {
        credentials: 'include',
      })
      
      if (response.status === 401) {
        setError('Nicht authentifiziert. Bitte melden Sie sich an.')
        return
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setTransactions(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      if (showLoadingIndicator) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    // Initial load with loading indicator
    loadHistorySmooth(true)
    
    // Auto-refresh every 10 seconds in background (smooth)
    const interval = setInterval(() => loadHistorySmooth(false), 10000)
    
    return () => clearInterval(interval)
  }, [])
  
  const getIcon = (type) => {
    const lowerType = type?.toLowerCase()
    switch (lowerType) {
      case 'borrow':
        return <ArrowExportLtr24Regular />
      case 'return':
        return <ArrowEnterLeft24Regular />
      case 'report_missing':
      case 'missing':
        return <Warning24Regular />
      case 'found':
        return <ArrowUndo24Regular />
      case 'delete':
        return <Dismiss24Regular />
      case 'location_change':
        return <ArrowSync24Regular />
      case 'update':
        return <ArrowSync24Regular />
      case 'create':
        return <Add24Regular />
      default:
        console.log('Unknown transaction type:', type)
        return <Clock24Regular />
    }
  }
  
  const getIconClass = (type) => {
    const lowerType = type?.toLowerCase()
    switch (lowerType) {
      case 'borrow':
        return styles.timelineIconBorrow
      case 'return':
        return styles.timelineIconReturn
      case 'report_missing':
      case 'missing':
        return styles.timelineIconMissing
      case 'found':
        return styles.timelineIconFound
      case 'delete':
        return styles.timelineIconDelete
      case 'location_change':
        return styles.timelineIconUpdate
      case 'update':
        return styles.timelineIconUpdate
      case 'create':
        return styles.timelineIconCreate
      default:
        return ''
    }
  }
  
  const getTypeText = (type) => {
    const lowerType = type?.toLowerCase()
    switch (lowerType) {
      case 'borrow':
        return 'Herausgegeben'
      case 'return':
        return 'Zurückgenommen'
      case 'report_missing':
      case 'missing':
        return 'Als vermisst gemeldet'
      case 'found':
        return 'Wiedergefunden'
      case 'delete':
        return 'Gelöscht'
      case 'location_change':
        return 'Standort geändert'
      case 'update':
        return 'Aktualisiert'
      case 'create':
        return 'Erstellt'
      default:
        return type
    }
  }
  
  const formatDate = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleString('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className={styles.container}>
      <PageHeader 
        title="Verlauf" 
        subtitle="Chronologische Übersicht aller Aktivitäten"
      />
      
      {error && (
        <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalL }}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      
      {loading ? (
        <div className={styles.loading}>
          <Spinner label="Verlauf wird geladen..." />
        </div>
      ) : transactions.length === 0 ? (
        <div className={styles.emptyState}>
          <Clock24Regular style={{ fontSize: '64px' }} />
          <h2>Noch keine Aktivitäten</h2>
          <p>Der Verlauf ist leer</p>
        </div>
      ) : (
        <div className={styles.timeline}>
          {filteredTransactions.map((transaction) => (
            <div key={transaction.id} className={styles.timelineItem}>
              <div className={`${styles.timelineIcon} ${getIconClass(transaction.transaction_type)}`}>
                {getIcon(transaction.transaction_type)}
              </div>
              
              <div className={styles.timelineContent}>
                <div className={styles.timelineHeader}>
                  <div>
                    <div className={styles.timelineTitle}>
                      {transaction.device_type} - {transaction.manufacturer} {transaction.model}
                    </div>
                    <div className={styles.timelineSubtitle}>
                      {getTypeText(transaction.transaction_type)}
                    </div>
                  </div>
                  <div className={styles.timelineTime}>
                    <Clock24Regular style={{ fontSize: '16px' }} />
                    {formatDate(transaction.created_at)}
                  </div>
                </div>
                
                <div className={styles.timelineDetails}>
                  <div className={styles.timelineDetail}>
                    <span className={styles.timelineDetailLabel}>Inventarnummer: </span>
                    <span className={styles.timelineDetailValue}>{transaction.inventory_number || '-'}</span>
                  </div>
                  {transaction.borrower_name && (
                    <div className={styles.timelineDetail}>
                      <span className={styles.timelineDetailLabel}>Person: </span>
                      <span className={styles.timelineDetailValue}>{transaction.borrower_name}</span>
                    </div>
                  )}
                  {transaction.user && (
                    <div className={styles.timelineDetail}>
                      <span className={styles.timelineDetailLabel}>Durchgeführt von: </span>
                      <span className={styles.timelineDetailValue}>{transaction.user.username}</span>
                    </div>
                  )}
                  {transaction.notes && (
                    <div className={styles.timelineDetail}>
                      <span className={styles.timelineDetailLabel}>Notiz: </span>
                      <span className={styles.timelineDetailValue}>{transaction.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
