/**
 * TaskDialog Component
 *
 * Modal dialog for creating and editing tasks
 * Demonstrates FluentUI Dialog, Field, Input, and Textarea components
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  Field,
  Input,
  Textarea,
  Dropdown,
  Option,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { createTask, updateTask } from '../../services/api'

const useStyles = makeStyles({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
})

export default function TaskDialog({ open, task, onClose }) {
  const styles = useStyles()

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('todo')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Initialize form when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setDescription(task.description || '')
      setStatus(task.status || 'todo')
      setStartDate(task.start_date ? new Date(task.start_date).toISOString().split('T')[0] : '')
      setEndDate(task.end_date ? new Date(task.end_date).toISOString().split('T')[0] : '')
    } else {
      setTitle('')
      setDescription('')
      setStatus('todo')
      setStartDate('')
      setEndDate('')
    }
    setError(null)
  }, [task, open])

  // Validation (CALCULATION)
  const isValid = () => {
    return title.trim().length > 0
  }

  // Handle submit (ACTION)
  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!isValid()) {
      setError('Title is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const taskData = {
        title: title.trim(),
        description: description.trim(),
        status: status,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        end_date: endDate ? new Date(endDate).toISOString() : null,
      }

      if (task) {
        // Update existing task
        await updateTask(task.id, taskData)
      } else {
        // Create new task
        await createTask(taskData)
      }

      onClose(true) // Close and refresh
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    onClose(false)
  }

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && handleCancel()}>
      <DialogSurface>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <DialogTitle>{task ? 'Edit Task' : 'Create New Task'}</DialogTitle>
            <DialogContent className={styles.content}>
              <Field
                label="Title"
                required
                validationMessage={error}
                validationState={error ? 'error' : undefined}
              >
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter task title..."
                  data-testid="task-title-input"
                  autoFocus
                />
              </Field>

              <Field label="Description" hint="Optional details about this task">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter task description..."
                  rows={4}
                  data-testid="task-description-input"
                />
              </Field>

              <Field label="Status">
                <Dropdown
                  value={status === 'todo' ? 'To Do' : status === 'in_progress' ? 'In Progress' : 'Done'}
                  selectedOptions={[status]}
                  onOptionSelect={(_, data) => setStatus(data.optionValue)}
                  data-testid="task-status-dropdown"
                >
                  <Option value="todo">To Do</Option>
                  <Option value="in_progress">In Progress</Option>
                  <Option value="done">Done</Option>
                </Dropdown>
              </Field>

              <Field label="Start Date" hint="When does this task start?">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="task-start-date-input"
                />
              </Field>

              <Field label="End Date" hint="When does this task end?">
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="task-end-date-input"
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={handleCancel}
                disabled={loading}
                data-testid="cancel-button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                appearance="primary"
                disabled={loading || !isValid()}
                data-testid="save-button"
              >
                {loading ? 'Saving...' : task ? 'Update' : 'Create'}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  )
}
