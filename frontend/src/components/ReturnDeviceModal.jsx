/**
 * ReturnDeviceModal - Confirm-Modal für "Gerät Zurücknehmen"
 * 
 * Kompaktes Confirm-Popup mit 3 Aktionen:
 * - Abbrechen (grau)
 * - Vermisst (gelb)
 * - Zurücknehmen (rot)
 */

import {
  Dialog,
  DialogSurface,
  makeStyles,
} from '@fluentui/react-components'
import {
  Dismiss24Regular,
} from '@fluentui/react-icons'

const useStyles = makeStyles({
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  
  surface: {
    width: '560px',
    maxWidth: 'calc(100vw - 32px)',
    backgroundColor: '#FFFFFF',
    border: '1px solid #D2D2D2',
    borderRadius: '6px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
    padding: '0',
    overflow: 'hidden',
  },
  
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 20px',
  },
  
  title: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#111111',
    margin: '0',
  },
  
  closeButton: {
    width: '32px',
    height: '32px',
    minWidth: '32px',
    minHeight: '32px',
    padding: '0',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    color: '#6C757D',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: 'rgba(0,0,0,0.06)',
    },
  },
  
  divider: {
    height: '1px',
    backgroundColor: '#DEE2E6',
    margin: '0',
    border: 'none',
  },
  
  content: {
    padding: '18px 20px 20px 20px',
  },
  
  text: {
    fontSize: '15px',
    fontWeight: '400',
    color: '#212529',
    margin: '0',
    lineHeight: '1.5',
  },
  
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 20px',
  },
  
  button: {
    height: '38px',
    paddingLeft: '16px',
    paddingRight: '16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '100px',
  },
  
  cancelButton: {
    backgroundColor: '#6C757D',
    color: '#FFFFFF',
    ':hover': {
      backgroundColor: '#5C636A',
    },
  },
  
  missingButton: {
    backgroundColor: '#FFC107',
    color: '#111111',
    ':hover': {
      backgroundColor: '#E0A800',
    },
  },
  
  returnButton: {
    backgroundColor: '#DC3545',
    color: '#FFFFFF',
    ':hover': {
      backgroundColor: '#BB2D3B',
    },
  },
})

export default function ReturnDeviceModal({ 
  open, 
  onOpenChange,
  deviceName = 'Laptop',
  onMarkMissing,
  onReturn,
}) {
  const styles = useStyles()
  
  const handleClose = () => {
    onOpenChange(null, { open: false })
  }
  
  const handleMarkMissing = () => {
    if (onMarkMissing) {
      onMarkMissing()
    }
    handleClose()
  }
  
  const handleReturn = () => {
    if (onReturn) {
      onReturn()
    }
    handleClose()
  }
  
  return (
    <Dialog 
      open={open} 
      onOpenChange={onOpenChange}
      modalType="modal"
    >
      <DialogSurface className={styles.surface}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Gerät Zurücknehmen</h2>
          <button 
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Schliessen"
          >
            <Dismiss24Regular />
          </button>
        </div>
        
        {/* Divider */}
        <div className={styles.divider} />
        
        {/* Content */}
        <div className={styles.content}>
          <p className={styles.text}>
            Soll das Gerät "{deviceName}" zurückgenommen werden?
          </p>
        </div>
        
        {/* Divider */}
        <div className={styles.divider} />
        
        {/* Footer */}
        <div className={styles.footer}>
          <button 
            className={`${styles.button} ${styles.cancelButton}`}
            onClick={handleClose}
          >
            Abbrechen
          </button>
          <button 
            className={`${styles.button} ${styles.missingButton}`}
            onClick={handleMarkMissing}
          >
            Vermisst
          </button>
          <button 
            className={`${styles.button} ${styles.returnButton}`}
            onClick={handleReturn}
          >
            Zurücknehmen
          </button>
        </div>
      </DialogSurface>
    </Dialog>
  )
}
