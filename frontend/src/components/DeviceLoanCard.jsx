/**
 * DeviceLoanCard - Card-Komponente für Ausleihgeräte
 * 
 * Pixel-genaue Umsetzung des Screenshots:
 * - Farbpanel oben (grün/rosa je nach Status)
 * - Footer unten mit Organisation und Action-Button
 * - Info-Icon rechts oben
 */

import { useState } from 'react'
import {
  makeStyles,
  Button,
} from '@fluentui/react-components'
import {
  Info24Regular,
  ArrowExportLtr24Regular,
  ArrowEnterLeft24Regular,
} from '@fluentui/react-icons'

const useStyles = makeStyles({
  card: {
    width: '100%',
    minHeight: '230px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #D2D2D2',
    borderRadius: '6px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  
  colorPanel: {
    position: 'relative',
    flex: '1',
    padding: '16px 18px 18px 18px',
  },
  
  colorPanelAvailable: {
    backgroundColor: '#D1E7DD',
  },
  
  colorPanelIssued: {
    backgroundColor: '#F8D7DA',
  },
  
  infoIcon: {
    position: 'absolute',
    top: '14px',
    right: '14px',
    width: '26px',
    height: '26px',
    minWidth: '26px',
    minHeight: '26px',
    padding: '0',
    border: '1px solid rgba(0,0,0,0.35)',
    borderRadius: '4px',
    backgroundColor: 'transparent',
    color: '#495057',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: 'rgba(0,0,0,0.06)',
    },
  },
  
  titleBlock: {
    marginBottom: '14px',
    paddingRight: '40px',
  },
  
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#111111',
    marginBottom: '2px',
    lineHeight: '1.2',
  },
  
  subtitle: {
    fontSize: '14px',
    fontWeight: '400',
    color: '#111111',
    lineHeight: '1.3',
  },
  
  fieldsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  
  field: {
    fontSize: '14px',
    lineHeight: '20px',
    color: '#111111',
  },
  
  fieldLabel: {
    fontWeight: '700',
  },
  
  fieldValue: {
    fontWeight: '400',
  },
  
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: '#F8F8F8',
    borderTop: '1px solid rgba(0,0,0,0.08)',
  },
  
  orgText: {
    fontSize: '13px',
    color: '#495057',
  },
  
  orgDepartment: {
    fontWeight: '700',
  },
  
  orgAmt: {
    fontWeight: '400',
  },
  
  actionButton: {
    height: '38px',
    paddingLeft: '16px',
    paddingRight: '16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'background-color 0.2s ease',
  },
  
  issueButton: {
    backgroundColor: '#198754',
    ':hover': {
      backgroundColor: '#157347',
    },
  },
  
  returnButton: {
    backgroundColor: '#DC3545',
    ':hover': {
      backgroundColor: '#BB2D3B',
    },
  },
})

export default function DeviceLoanCard({
  category,
  subtitle,
  fields = [],
  department,
  amt,
  status = 'available',
  borrowerName = null,
  onIssueClick,
  onReturnClick,
  onInfoClick,
  disableActions = false,
}) {
  const styles = useStyles()
  
  const isAvailable = status === 'available'
  const colorPanelClass = isAvailable ? styles.colorPanelAvailable : styles.colorPanelIssued
  
  // Add borrower info to fields if device is issued
  const displayFields = [...fields]
  if (!isAvailable && borrowerName) {
    displayFields.push({ label: 'Ausgeliehen an', value: borrowerName })
  }
  
  return (
    <div className={styles.card}>
      {/* Farbpanel oben */}
      <div className={`${styles.colorPanel} ${colorPanelClass}`}>
        {/* Info-Icon rechts oben */}
        {onInfoClick && (
          <button 
            className={styles.infoIcon}
            onClick={onInfoClick}
            aria-label="Info"
          >
            <Info24Regular style={{ width: '16px', height: '16px' }} />
          </button>
        )}
        
        {/* Titelblock */}
        <div className={styles.titleBlock}>
          <div className={styles.title}>{category}</div>
          <div className={styles.subtitle}>{subtitle}</div>
        </div>
        
        {/* Felderliste */}
        <div className={styles.fieldsList}>
          {displayFields.map((field, index) => (
            <div key={index} className={styles.field}>
              <span className={styles.fieldLabel}>{field.label}: </span>
              <span className={styles.fieldValue}>{field.value}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Footer mit Organisation und Action-Button */}
      <div className={styles.footer}>
        <div className={styles.orgText}>
          {department && amt ? (
            <>
              <span className={styles.orgDepartment}>{department}</span>
              {' / '}
              <span className={styles.orgAmt}>{amt}</span>
            </>
          ) : department ? (
            <span className={styles.orgDepartment}>{department}</span>
          ) : amt ? (
            <span className={styles.orgAmt}>{amt}</span>
          ) : (
            '-'
          )}
        </div>
        
        {isAvailable ? (
          <button 
            className={`${styles.actionButton} ${styles.issueButton}`}
            onClick={disableActions ? undefined : onIssueClick}
            disabled={disableActions}
            style={disableActions ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            aria-disabled={disableActions}
          >
            <ArrowExportLtr24Regular style={{ width: '20px', height: '20px' }} />
            Herausgeben
          </button>
        ) : (
          <button 
            className={`${styles.actionButton} ${styles.returnButton}`}
            onClick={disableActions ? undefined : onReturnClick}
            disabled={disableActions}
            style={disableActions ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            aria-disabled={disableActions}
          >
            <ArrowEnterLeft24Regular style={{ width: '20px', height: '20px' }} />
            Zuruecknehmen
          </button>
        )}
      </div>
    </div>
  )
}
