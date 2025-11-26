/**
 * TimeLogDialog Component
 *
 * Dialog for logging time spent on tasks and optionally closing them
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  Field,
  Input,
  Checkbox,
  makeStyles,
  tokens,
  Text,
} from '@fluentui/react-components'
import { updateTask } from '../../services/api'

const useStyles = makeStyles({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    backgroundColor: 'var(--bg-color)',
    color: 'var(--text-color)',
  },
  currentTime: {
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    marginBottom: tokens.spacingVerticalM,
  },
  infoText: {
    fontSize: tokens.fontSizeBase200,
    color: 'var(--text-color)',
    opacity: 0.8,
  },
})

export default function TimeLogDialog({ open, task, onClose }) {
  const styles = useStyles()

  const [timeToAdd, setTimeToAdd] = useState('')
  const [closeTask, setCloseTask] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTimeToAdd('')
      setCloseTask(false)
      setError(null)
    }
  }, [open, task])

  // ============================================================================
  // ACTIONS - Side effects (API calls, event handlers)
  // ============================================================================

  const handleSubmit = async () => {
    if (!task) return

    const hoursToAdd = parseFloat(timeToAdd)
    if (isNaN(hoursToAdd) || hoursToAdd <= 0) {
      setError('Bitte gib eine gültige Stundenanzahl ein (größer als 0)')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const newTimeSpent = (task.time_spent || 0) + hoursToAdd
      
      await updateTask(task.id, {
        time_spent: newTimeSpent,
        completed: closeTask ? true : task.completed,
      })

      onClose(true) // Indicate success
    } catch (err) {
      setError(err.message || 'Fehler beim Verbuchen der Zeit')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    onClose(false)
  }

  // ============================================================================
  // CALCULATIONS - Pure functions
  // ============================================================================

  const formatTime = (hours) => {
    if (!hours) return '0h'
    if (hours < 1) {
      return `${Math.round(hours * 60)}min`
    }
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return m > 0 ? `${h}h ${m}min` : `${h}h`
  }

  const calculateNewTotal = () => {
    const hoursToAdd = parseFloat(timeToAdd)
    if (isNaN(hoursToAdd) || hoursToAdd <= 0) return null
    return (task?.time_spent || 0) + hoursToAdd
  }

  if (!task) return null

  const newTotal = calculateNewTotal()

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && handleCancel()}>
      <DialogSurface>
        <DialogTitle>Zeit verbuchen</DialogTitle>
        <DialogBody>
          <DialogContent className={styles.content}>
            <div className={styles.currentTime}>
              <Text weight="semibold">Ticket: {task.title}</Text>
              <Text className={styles.infoText}>
                Bisher verbucht: {formatTime(task.time_spent || 0)}
              </Text>
            </div>

            <Field
              label="Stunden hinzufügen"
              validationMessage={error}
              validationState={error ? 'error' : 'none'}
              required
            >
              <Input
                type="number"
                step="0.25"
                min="0"
                placeholder="z.B. 2.5 für 2,5 Stunden"
                value={timeToAdd}
                onChange={(e) => setTimeToAdd(e.target.value)}
                disabled={loading}
              />
            </Field>

            {newTotal !== null && (
              <Text className={styles.infoText}>
                Neue Gesamtzeit: {formatTime(newTotal)}
              </Text>
            )}

            {!task.completed && (
              <Checkbox
                label="Ticket gleichzeitig schließen"
                checked={closeTask}
                onChange={(_, data) => setCloseTask(data.checked)}
                disabled={loading}
              />
            )}

            {task.completed && (
              <Text className={styles.infoText}>
                ℹ️ Dieses Ticket ist bereits geschlossen
              </Text>
            )}
          </DialogContent>

          <DialogActions>
            <Button appearance="secondary" onClick={handleCancel} disabled={loading}>
              Abbrechen
            </Button>
            <Button appearance="primary" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Wird verbucht...' : 'Zeit verbuchen'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
