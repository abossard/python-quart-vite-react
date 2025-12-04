/**
 * IssueDeviceModal - Modal "Gerät Herausgeben"
 * 
 * Popup mit Name-Input und Validation
 * Exakte Spezifikation: 520px breit, strukturiert Header/Content/Footer
 */

import { useState } from 'react'
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogContent,
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
    width: '520px',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 18px',
    borderBottom: '1px solid #DEE2E6',
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
  
  content: {
    padding: '18px',
  },
  
  label: {
    display: 'block',
    fontSize: '14px',
    color: '#212529',
    marginBottom: '8px',
    fontWeight: '600',
  },
  
  input: {
    width: '100%',
    height: '38px',
    border: '1px solid #CED4DA',
    borderRadius: '6px',
    paddingLeft: '12px',
    paddingRight: '12px',
    fontSize: '14px',
    fontFamily: 'inherit',
    color: '#212529',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease',
    ':focus': {
      outline: 'none',
      borderColor: '#198754',
    },
  },
  
  inputError: {
    borderColor: '#DC3545',
  },
  
  errorText: {
    fontSize: '12px',
    color: '#DC3545',
    marginTop: '6px',
  },
  
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 18px',
    borderTop: '1px solid #DEE2E6',
  },
  
  button: {
    height: '38px',
    paddingLeft: '16px',
    paddingRight: '16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '100px',
  },
  
  cancelButton: {
    backgroundColor: '#6C757D',
    ':hover': {
      backgroundColor: '#5C636A',
    },
    ':disabled': {
      opacity: '0.6',
      cursor: 'not-allowed',
    },
  },
  
  issueButton: {
    backgroundColor: '#198754',
    ':hover': {
      backgroundColor: '#157347',
    },
    ':disabled': {
      opacity: '0.6',
      cursor: 'not-allowed',
    },
  },
})

export default function IssueDeviceModal({ 
  open, 
  onOpenChange, 
  onSubmit,
  deviceInfo = null,
}) {
  const styles = useStyles()
  const [personName, setPersonName] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const handleClose = () => {
    setPersonName('')
    setError('')
    setIsSubmitting(false)
    onOpenChange(null, { open: false })
  }
  
  const handleSubmit = async () => {
    // Validation
    if (!personName.trim()) {
      setError('Bitte Name eingeben')
      return
    }
    
    setError('')
    setIsSubmitting(true)
    
    try {
      await onSubmit(personName.trim())
      handleClose()
    } catch (err) {
      setError(err.message || 'Fehler beim Herausgeben')
      setIsSubmitting(false)
    }
  }
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isSubmitting) {
      handleSubmit()
    }
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
          <h2 className={styles.title}>Geraet Herausgeben</h2>
          <button 
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Schliessen"
            disabled={isSubmitting}
          >
            <Dismiss24Regular />
          </button>
        </div>
        
        {/* Content */}
        <div className={styles.content}>
          <label className={styles.label}>
            Name der Person
          </label>
          <input
            type="text"
            className={`${styles.input} ${error ? styles.inputError : ''}`}
            value={personName}
            onChange={(e) => {
              setPersonName(e.target.value)
              if (error) setError('')
            }}
            onKeyPress={handleKeyPress}
            placeholder=""
            disabled={isSubmitting}
            autoFocus
          />
          {error && (
            <div className={styles.errorText}>{error}</div>
          )}
        </div>
        
        {/* Footer */}
        <div className={styles.footer}>
          <button 
            className={`${styles.button} ${styles.cancelButton}`}
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Abbrechen
          </button>
          <button 
            className={`${styles.button} ${styles.issueButton}`}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Wird herausgegeben...' : 'Herausgeben'}
          </button>
        </div>
      </DialogSurface>
    </Dialog>
  )
}
