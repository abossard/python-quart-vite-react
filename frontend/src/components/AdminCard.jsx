/**
 * AdminCard - Wiederverwendbare Card-Komponente für Verwaltungsseiten
 * 
 * Features:
 * - Hellgrauer Header mit Titel
 * - Action-Buttons rechts (Info, Edit, Delete)
 * - Body mit Label/Value Paaren
 * - Status-Backgrounds (optional)
 * - Responsive Grid-ready
 */

import { useState } from 'react'
import {
  makeStyles,
  tokens,
  Button,
} from '@fluentui/react-components'
import {
  Info24Regular,
  Edit24Regular,
  Delete24Regular,
} from '@fluentui/react-icons'
import { statusBackgrounds } from '../theme'
import DetailDialog from './DetailDialog'

const useStyles = makeStyles({
  card: {
    width: '100%',
    minHeight: '172px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #D2D2D2',
    borderRadius: '6px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  
  header: {
    height: '49px',
    backgroundColor: '#F8F8F8',
    borderBottom: '1px solid #D2D2D2',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: '18px',
    paddingRight: '18px',
  },
  
  headerTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#111111',
  },
  
  actions: {
    display: 'flex',
    gap: '4px',
  },
  
  actionButton: {
    minWidth: '32px',
    minHeight: '32px',
    width: '32px',
    height: '32px',
    borderRadius: '4px',
    padding: 0,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    outline: 'none',
  },
  
  infoButton: {
    minWidth: '32px',
    minHeight: '32px',
    width: '32px',
    height: '32px',
    padding: '0',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#6C757D',
    color: '#FFFFFF !important',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#5C636A',
      color: '#FFFFFF !important',
    },
    ':active': {
      backgroundColor: '#4E555B',
      color: '#FFFFFF !important',
    },
  },
  
  editButton: {
    minWidth: '32px',
    minHeight: '32px',
    width: '32px',
    height: '32px',
    padding: '0',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#0D6EFD',
    color: '#FFFFFF !important',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#0B5ED7',
      color: '#FFFFFF !important',
    },
    ':active': {
      backgroundColor: '#0A58CA',
      color: '#FFFFFF !important',
    },
  },
  
  deleteButton: {
    minWidth: '32px',
    minHeight: '32px',
    width: '32px',
    height: '32px',
    padding: '0',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#DC3545',
    color: '#FFFFFF !important',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#BB2D3B',
      color: '#FFFFFF !important',
    },
    ':active': {
      backgroundColor: '#A02A37',
      color: '#FFFFFF !important',
    },
  },
  
  restoreButton: {
    minWidth: '32px',
    minHeight: '32px',
    width: '32px',
    height: '32px',
    padding: '0',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#198754',
    color: '#FFFFFF !important',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#157347',
      color: '#FFFFFF !important',
    },
    ':active': {
      backgroundColor: '#146C43',
      color: '#FFFFFF !important',
    },
  },
  
  body: {
    backgroundColor: '#FFFFFF',
    padding: '16px',
  },
  
  field: {
    fontSize: '14px',
    lineHeight: '20px',
    color: '#111111',
    marginBottom: '12px',
    ':last-child': {
      marginBottom: 0,
    },
  },
  
  label: {
    fontWeight: '700',
  },
  
  value: {
    fontWeight: '400',
  },
  
  // Status-Background Variants
  dangerBackground: {
    backgroundColor: statusBackgrounds.dangerSubtle,
  },
  
  successBackground: {
    backgroundColor: statusBackgrounds.successSubtle,
  },
  
  warningBackground: {
    backgroundColor: statusBackgrounds.warningSubtle,
  },
})

export default function AdminCard({
  title,
  fields = [],
  showInfo = false,
  onInfo,
  onEdit,
  onDelete,
  statusBackground = null, // 'danger' | 'success' | 'warning' | null
  children,
  detailData = null, // Data to show in detail dialog
  actionButtons = null, // Custom action buttons array [{icon, onClick, appearance, title}]
}) {
  const styles = useStyles()
  const [dialogOpen, setDialogOpen] = useState(false)
  
  const getStatusClass = () => {
    if (!statusBackground) return ''
    switch (statusBackground) {
      case 'danger':
        return styles.dangerBackground
      case 'success':
        return styles.successBackground
      case 'warning':
        return styles.warningBackground
      default:
        return ''
    }
  }
  
  return (
    <div className={`${styles.card} ${getStatusClass()}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>{title}</div>
        
        <div className={styles.actions}>
          {actionButtons ? (
            // Custom action buttons for special cases (e.g., Missing Devices)
            actionButtons.map((button, index) => (
              <Button
                key={index}
                appearance="primary"
                icon={button.icon}
                onClick={button.onClick}
                aria-label={button.title}
                title={button.title}
                className={styles[button.colorClass] || styles.infoButton}
              />
            ))
          ) : (
            // Default action buttons
            <>
              {showInfo && (
                <Button
                  appearance="primary"
                  icon={<Info24Regular />}
                  onClick={() => setDialogOpen(true)}
                  aria-label="Info"
                  className={styles.infoButton}
                />
              )}
              {onEdit && (
                <Button
                  appearance="primary"
                  icon={<Edit24Regular />}
                  onClick={onEdit}
                  aria-label="Bearbeiten"
                  title="Bearbeiten"
                  className={styles.editButton}
                />
              )}
              {onDelete && (
                <Button
                  appearance="primary"
                  icon={<Delete24Regular />}
                  onClick={onDelete}
                  aria-label="Löschen"
                  title="Löschen"
                  className={styles.deleteButton}
                />
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Body */}
      <div className={styles.body}>
        {fields.map((field, index) => (
          <div key={index} className={styles.field}>
            <span className={styles.label}>{field.label}: </span>
            <span className={styles.value}>{field.value}</span>
          </div>
        ))}
        {children}
      </div>
      
      {/* Detail Dialog */}
      {showInfo && (
        <DetailDialog
          open={dialogOpen}
          onOpenChange={(_, data) => setDialogOpen(data.open)}
          data={detailData || { title, fields }}
        />
      )}
    </div>
  )
}
