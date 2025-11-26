import { useState } from 'react'
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  Text,
  Badge,
  Divider,
  Input,
  Textarea,
  Dropdown,
  Option,
  Field,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  Dismiss24Regular,
  Clock24Regular,
  Person24Regular,
  Calendar24Regular,
} from '@fluentui/react-icons'
import { addWorklog, updateTicket } from '../../../services/api'

const useStyles = makeStyles({
  dialogSurface: {
    maxWidth: '700px',
    width: '90vw',
  },
  section: {
    marginBottom: tokens.spacingVerticalL,
  },
  sectionTitle: {
    marginBottom: tokens.spacingVerticalS,
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr',
    gap: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalM,
  },
  detailLabel: {
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightSemibold,
  },
  detailValue: {
    color: tokens.colorNeutralForeground1,
  },
  badgeContainer: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  worklogList: {
    maxHeight: '200px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  worklogItem: {
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  worklogHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalXS,
  },
  worklogMeta: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  worklogDescription: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
  },
  worklogForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  timeInputs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingHorizontalM,
  },
  noWorklogs: {
    textAlign: 'center',
    padding: tokens.spacingVerticalL,
    color: tokens.colorNeutralForeground3,
  },
})

const priorityColors = {
  Critical: 'danger',
  High: 'warning',
  Medium: 'informative',
  Low: 'success',
}

const statusColors = {
  Open: 'informative',
  'In Progress': 'warning',
  'Waiting on Customer': 'subtle',
  Resolved: 'success',
  Closed: 'subtle',
}

const TECHNICIANS = ['Kusi', 'Noah', 'Raphael', 'Luis', 'Mike', 'Sandro']

export function TicketDetailModal({ ticket, isOpen, onClose, onUpdate }) {
  const styles = useStyles()
  const [showWorklogForm, setShowWorklogForm] = useState(false)
  const [worklogHours, setWorklogHours] = useState('0')
  const [worklogMinutes, setWorklogMinutes] = useState('30')
  const [worklogDescription, setWorklogDescription] = useState('')
  const [worklogTechnician, setWorklogTechnician] = useState(ticket?.assigned_to || '')
  const [submitting, setSubmitting] = useState(false)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState(null)

  if (!ticket) return null

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  const handleAddWorklog = async () => {
    try {
      setSubmitting(true)
      setError(null)

      const hours = parseInt(worklogHours) || 0
      const minutes = parseInt(worklogMinutes) || 0
      const totalMinutes = hours * 60 + minutes

      if (totalMinutes <= 0) {
        setError('Please enter a valid time duration')
        return
      }

      if (!worklogDescription.trim()) {
        setError('Please enter a description')
        return
      }

      if (!worklogTechnician) {
        setError('Please select a technician')
        return
      }

      const worklogData = {
        technician: worklogTechnician,
        time_spent_minutes: totalMinutes,
        description: worklogDescription.trim(),
      }

      const updatedTicket = await addWorklog(ticket.id, worklogData)

      // Reset form
      setWorklogHours('0')
      setWorklogMinutes('30')
      setWorklogDescription('')
      setShowWorklogForm(false)

      // Notify parent
      if (onUpdate) {
        onUpdate(updatedTicket)
      }
    } catch (err) {
      setError(err.message || 'Failed to add worklog')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCloseTicket = async () => {
    try {
      setClosing(true)
      setError(null)

      const updatedTicket = await updateTicket(ticket.id, { status: 'closed' })

      // Notify parent
      if (onUpdate) {
        onUpdate(updatedTicket)
      }

      // Close modal after successful update
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (err) {
      setError(err.message || 'Failed to close ticket')
    } finally {
      setClosing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface className={styles.dialogSurface}>
        <DialogBody>
          <DialogTitle
            action={
              <Button
                appearance="subtle"
                aria-label="close"
                icon={<Dismiss24Regular />}
                onClick={onClose}
              />
            }
          >
            Ticket #{ticket.id}
          </DialogTitle>

          <DialogContent>
            <div className={styles.section}>
              <Text className={styles.sectionTitle}>{ticket.title}</Text>
              <div className={styles.badgeContainer}>
                <Badge color={priorityColors[ticket.priority]}>{ticket.priority}</Badge>
                <Badge color={statusColors[ticket.status]}>{ticket.status}</Badge>
                <Badge appearance="outline">{ticket.category}</Badge>
              </div>
            </div>

            <Divider />

            <div className={styles.section}>
              <div className={styles.detailGrid}>
                <Text className={styles.detailLabel}>Requester:</Text>
                <Text className={styles.detailValue}>{ticket.requester_name}</Text>

                <Text className={styles.detailLabel}>Email:</Text>
                <Text className={styles.detailValue}>{ticket.requester_email}</Text>

                <Text className={styles.detailLabel}>Assigned To:</Text>
                <Text className={styles.detailValue}>{ticket.assigned_to || 'Unassigned'}</Text>

                <Text className={styles.detailLabel}>Created:</Text>
                <Text className={styles.detailValue}>{formatDate(ticket.created_at)}</Text>

                {ticket.resolved_at && (
                  <>
                    <Text className={styles.detailLabel}>Resolved:</Text>
                    <Text className={styles.detailValue}>{formatDate(ticket.resolved_at)}</Text>
                  </>
                )}

                {ticket.resolution_hours && (
                  <>
                    <Text className={styles.detailLabel}>Resolution Time:</Text>
                    <Text className={styles.detailValue}>
                      {ticket.resolution_hours.toFixed(1)} hours
                    </Text>
                  </>
                )}
              </div>
            </div>

            <Divider />

            <div className={styles.section}>
              <Text className={styles.sectionTitle}>Description</Text>
              <Text>{ticket.description}</Text>
            </div>

            <Divider />

            <div className={styles.section}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacingVerticalS }}>
                <Text className={styles.sectionTitle}>Worklogs</Text>
                <Button
                  appearance="primary"
                  size="small"
                  onClick={() => setShowWorklogForm(!showWorklogForm)}
                >
                  {showWorklogForm ? 'Cancel' : 'Add Worklog'}
                </Button>
              </div>

              {showWorklogForm && (
                <div className={styles.worklogForm}>
                  <Field label="Technician" required>
                    <Dropdown
                      placeholder="Select technician"
                      value={worklogTechnician}
                      selectedOptions={[worklogTechnician]}
                      onOptionSelect={(_, data) => setWorklogTechnician(data.optionValue)}
                    >
                      {TECHNICIANS.map((tech) => (
                        <Option key={tech} value={tech}>
                          {tech}
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>

                  <div className={styles.timeInputs}>
                    <Field label="Hours">
                      <Input
                        type="number"
                        min="0"
                        value={worklogHours}
                        onChange={(e) => setWorklogHours(e.target.value)}
                      />
                    </Field>
                    <Field label="Minutes">
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={worklogMinutes}
                        onChange={(e) => setWorklogMinutes(e.target.value)}
                      />
                    </Field>
                  </div>

                  <Field label="Description" required>
                    <Textarea
                      placeholder="What work was performed?"
                      value={worklogDescription}
                      onChange={(e) => setWorklogDescription(e.target.value)}
                      rows={3}
                    />
                  </Field>

                  {error && (
                    <Text style={{ color: tokens.colorPaletteRedForeground1 }}>{error}</Text>
                  )}

                  <Button
                    appearance="primary"
                    onClick={handleAddWorklog}
                    disabled={submitting}
                  >
                    {submitting ? 'Adding...' : 'Add Worklog'}
                  </Button>
                </div>
              )}

              <div className={styles.worklogList}>
                {ticket.worklogs && ticket.worklogs.length > 0 ? (
                  ticket.worklogs.map((log, index) => (
                    <div key={index} className={styles.worklogItem}>
                      <div className={styles.worklogHeader}>
                        <Text weight="semibold">{log.technician}</Text>
                        <Badge appearance="tint">
                          {Math.floor(log.time_spent_minutes / 60)}h{' '}
                          {log.time_spent_minutes % 60}m
                        </Badge>
                      </div>
                      <div className={styles.worklogMeta}>
                        <span>
                          <Calendar24Regular
                            style={{ fontSize: '12px', verticalAlign: 'middle' }}
                          />{' '}
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                      <Text className={styles.worklogDescription}>{log.description}</Text>
                    </div>
                  ))
                ) : (
                  <div className={styles.noWorklogs}>
                    <Text>No worklogs yet</Text>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>

          <DialogActions>
            {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
              <Button
                appearance="primary"
                onClick={handleCloseTicket}
                disabled={closing}
              >
                {closing ? 'Closing...' : 'Close Ticket'}
              </Button>
            )}
            <Button appearance="secondary" onClick={onClose}>
              Close Dialog
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
