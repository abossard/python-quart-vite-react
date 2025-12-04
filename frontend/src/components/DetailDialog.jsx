/**
 * DetailDialog - Modal für detaillierte Ansicht
 * 
 * Modal Dialog mit vollständigen Geräte-/Objektdetails
 * Exakte Spezifikation: 498x473px, Overlay mit rgba(0,0,0,0.45)
 */

import {
  makeStyles,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Textarea,
} from '@fluentui/react-components'
import {
  Dismiss24Regular,
} from '@fluentui/react-icons'

const useStyles = makeStyles({
  surface: {
    width: '498px',
    maxWidth: 'calc(100vw - 32px)',
    minHeight: '470px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #D2D2D2',
    borderRadius: '6px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
    overflow: 'hidden',
    padding: '0 !important',
  },
  
  body: {
    padding: '0 !important',
    margin: 0,
  },
  
  titleBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: '62px',
    backgroundColor: '#F8F8F8',
    borderBottom: '1px solid #D2D2D2',
    margin: '0',
    padding: '0',
    width: '100%',
    minWidth: '100%',
    flexShrink: 0,
    boxSizing: 'border-box',
  },
  
  titleText: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#111111',
    margin: 0,
    padding: '0 0 0 18px',
  },
  
  closeButtonContainer: {
    padding: '0 18px 0 0',
  },
  
  closeButton: {
    minWidth: '32px',
    minHeight: '32px',
    width: '32px',
    height: '32px',
    padding: 0,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    color: '#6C757D',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ':hover': {
      backgroundColor: 'rgba(0,0,0,0.06)',
    },
  },
  
  contentWrapper: {
    padding: '0 !important',
  },
  
  content: {
    padding: '18px',
    overflowY: 'auto',
  },
  
  infoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '18px',
  },
  
  infoLine: {
    fontSize: '14px',
    lineHeight: '20px',
    color: '#212529',
  },
  
  label: {
    fontWeight: '700',
  },
  
  value: {
    fontWeight: '400',
  },
  
  extraInfoLabel: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#212529',
    marginBottom: '8px',
  },
  
  textarea: {
    width: '100%',
    height: '84px',
    border: '1px solid #CED4DA',
    borderRadius: '6px',
    backgroundColor: '#F8F8F8',
    padding: '12px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'none',
  },
  
  footer: {
    padding: '14px 18px',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  
  closeActionButton: {
    height: '38px',
    paddingLeft: '18px',
    paddingRight: '18px',
    borderRadius: '6px',
    backgroundColor: '#6C757D',
    color: '#FFFFFF',
    border: 'none',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#5C636A',
    },
  },
})

export default function DetailDialog({ open, onOpenChange, data }) {
  const styles = useStyles()
  
  if (!data) return null
  
  // Format title from device data
  const title = data.device_type || 'Gerät'
  
  return (
    <Dialog 
      open={open} 
      onOpenChange={onOpenChange}
      modalType="modal"
    >
      <DialogSurface className={styles.surface}>
        {/* Titlebar - outside DialogBody for full width */}
        <div className={styles.titleBar}>
          <h2 className={styles.titleText}>{title}</h2>
          <div className={styles.closeButtonContainer}>
            <button 
              className={styles.closeButton}
              onClick={() => onOpenChange(null, { open: false })}
              aria-label="Schliessen"
            >
              <Dismiss24Regular />
            </button>
          </div>
        </div>
        
        <DialogBody className={styles.body}>
          
          {/* Content */}
          <DialogContent className={styles.contentWrapper}>
            <div className={styles.content}>
            <div className={styles.infoList}>
              <div className={styles.infoLine}>
                <span className={styles.label}>Kategorie: </span>
                <span className={styles.value}>{data.device_type || '-'}</span>
              </div>
              <div className={styles.infoLine}>
                <span className={styles.label}>Hersteller: </span>
                <span className={styles.value}>{data.manufacturer || '-'}</span>
              </div>
              <div className={styles.infoLine}>
                <span className={styles.label}>Modell: </span>
                <span className={styles.value}>{data.model || '-'}</span>
              </div>
              <div className={styles.infoLine}>
                <span className={styles.label}>Seriennummer: </span>
                <span className={styles.value}>{data.serial_number || '-'}</span>
              </div>
              <div className={styles.infoLine}>
                <span className={styles.label}>Inventarnummer: </span>
                <span className={styles.value}>{data.inventory_number || '-'}</span>
              </div>
              <div className={styles.infoLine}>
                <span className={styles.label}>Standort: </span>
                <span className={styles.value}>{data.location?.name || '-'}</span>
              </div>
              <div className={styles.infoLine}>
                <span className={styles.label}>Status: </span>
                <span className={styles.value}>{data.status || '-'}</span>
              </div>
              {data.borrower_name && (
                <div className={styles.infoLine}>
                  <span className={styles.label}>Ausgeliehen an: </span>
                  <span className={styles.value}>{data.borrower_name}</span>
                </div>
              )}
            </div>
            
            <div className={styles.extraInfoLabel}>Extra Info:</div>
            <textarea 
              className={styles.textarea}
              placeholder="Zusätzliche Informationen..."
              defaultValue={data.notes || ''}
              readOnly
            />
            </div>
          </DialogContent>
          
          {/* Footer */}
          <DialogActions className={styles.footer}>
            <button 
              className={styles.closeActionButton}
              onClick={() => onOpenChange(null, { open: false })}
            >
              Schliessen
            </button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
