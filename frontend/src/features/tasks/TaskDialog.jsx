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
  Radio,
  RadioGroup,
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
  const [priority, setPriority] = useState('medium')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Initialize form when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setDescription(task.description || '')
      setPriority(task.priority || 'medium')
    } else {
      setTitle('')
      setDescription('')
      setPriority('medium')
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
        priority: priority,
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

              <Field label="Priority">
                <RadioGroup
                  value={priority}
                  onChange={(_, data) => setPriority(data.value)}
                  data-testid="task-priority-input"
                >
                  <Radio value="critical" label="🔴 Critical" />
                  <Radio value="high" label="🟠 High" />
                  <Radio value="medium" label="🟡 Medium" />
                  <Radio value="low" label="🟢 Low" />
                </RadioGroup>
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
