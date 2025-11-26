/**
 * TaskList Component
 *
 * Displays a list of tasks with CRUD operations
 * Demonstrates FluentUI List, Button, Dialog, and Form components
 *
 * Following principles:
 * - Pure functions for data transformations (calculations)
 * - Side effects isolated in event handlers (actions)
 * - Clear component interface
 */

import { useState, useEffect } from 'react'
import {
  Card,
  CardHeader,
  Text,
  Button,
  DataGrid,
  DataGridBody,
  DataGridRow,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  TableCellLayout,
  createTableColumn,
  makeStyles,
  tokens,
  Badge,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Spinner,
  ToggleButton,
} from '@fluentui/react-components'
import {
  Add24Regular,
  MoreVertical20Regular,
  Edit20Regular,
  Delete20Regular,
  Checkmark20Regular,
  Dismiss20Regular,
  Clock20Regular,
} from '@fluentui/react-icons'
import { getTasks, deleteTask, updateTask } from '../../services/api'
import TaskDialog from './TaskDialog'
import TimeLogDialog from './TimeLogDialog'

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
    backgroundColor: 'var(--bg-color)',
  },
  card: {
    maxWidth: '1200px',
    margin: '0 auto',
    backgroundColor: 'var(--bg-color)',
    color: 'var(--text-color)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterBar: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalM,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  emptyState: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXXXL,
    color: 'var(--text-color)',
  },
})

// ============================================================================
// CALCULATIONS - Pure functions
// ============================================================================

function formatDate(isoString) {
  const date = new Date(isoString)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

function formatTime(hours) {
  if (!hours) return '0h'
  if (hours < 1) {
    return `${Math.round(hours * 60)}min`
  }
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function getTaskStats(tasks) {
  return {
    total: tasks.length,
    completed: tasks.filter((t) => t.completed).length,
    pending: tasks.filter((t) => !t.completed).length,
  }
}

function sortTasks(tasks, sortBy) {
  const sorted = [...tasks]
  
  switch (sortBy) {
    case 'date':
      return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    case 'title':
      return sorted.sort((a, b) => a.title.localeCompare(b.title))
    case 'status':
      return sorted.sort((a, b) => {
        if (a.completed === b.completed) return 0
        return a.completed ? 1 : -1
      })
    case 'priority':
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
      return sorted.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    default:
      return sorted
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function TaskList() {
  const styles = useStyles()

  // State
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [timeLogDialogOpen, setTimeLogDialogOpen] = useState(false)
  const [timeLogTask, setTimeLogTask] = useState(null)

  // Load tasks
  const loadTasks = async (filterValue = filter) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getTasks(filterValue)
      setTasks(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [filter])

  // Event handlers (ACTIONS)
  const handleCreate = () => {
    setEditingTask(null)
    setDialogOpen(true)
  }

  const handleEdit = (task) => {
    setEditingTask(task)
    setDialogOpen(true)
  }

  const handleDelete = async (taskId) => {
    try {
      await deleteTask(taskId)
      await loadTasks()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleToggleComplete = async (task) => {
    try {
      await updateTask(task.id, { completed: !task.completed })
      await loadTasks()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDialogClose = (shouldRefresh) => {
    setDialogOpen(false)
    setEditingTask(null)
    if (shouldRefresh) {
      loadTasks()
    }
  }

  const handleLogTime = (task) => {
    setTimeLogTask(task)
    setTimeLogDialogOpen(true)
  }

  const handleTimeLogClose = (shouldRefresh) => {
    setTimeLogDialogOpen(false)
    setTimeLogTask(null)
    if (shouldRefresh) {
      loadTasks()
    }
  }

  // Calculate stats
  const stats = getTaskStats(tasks)

  // Sort tasks
  const sortedTasks = sortTasks(tasks, sortBy)

  // Define columns
  const columns = [
    createTableColumn({
      columnId: 'status',
      renderHeaderCell: () => 'Status',
      renderCell: (task) => (
        <TableCellLayout>
          <Badge
            appearance={task.completed ? 'filled' : 'outline'}
            color={task.completed ? 'success' : 'warning'}
          >
            {task.completed ? 'Done' : 'Pending'}
          </Badge>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'priority',
      renderHeaderCell: () => 'Priority',
      renderCell: (task) => {
        const priorityConfig = {
          urgent: { color: 'danger', label: 'Urgent' },
          high: { color: 'warning', label: 'High' },
          medium: { color: 'informative', label: 'Medium' },
          low: { color: 'subtle', label: 'Low' },
        }
        const config = priorityConfig[task.priority] || priorityConfig.medium
        return (
          <TableCellLayout>
            <Badge appearance="filled" color={config.color}>
              {config.label}
            </Badge>
          </TableCellLayout>
        )
      },
    }),
    createTableColumn({
      columnId: 'title',
      renderHeaderCell: () => 'Title',
      renderCell: (task) => (
        <TableCellLayout data-testid={`task-title-${task.id}`}>
          <Text weight="semibold">{task.title}</Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'description',
      renderHeaderCell: () => 'Description',
      renderCell: (task) => (
        <TableCellLayout>
          <Text>{task.description || '—'}</Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'time',
      renderHeaderCell: () => 'Zeit verbucht',
      renderCell: (task) => (
        <TableCellLayout>
          <Text weight="semibold">{formatTime(task.time_spent || 0)}</Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'created',
      renderHeaderCell: () => 'Created',
      renderCell: (task) => (
        <TableCellLayout>
          <Text size={200}>{formatDate(task.created_at)}</Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'actions',
      renderHeaderCell: () => 'Actions',
      renderCell: (task) => (
        <TableCellLayout>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              size="small"
              icon={task.completed ? <Dismiss20Regular /> : <Checkmark20Regular />}
              onClick={() => handleToggleComplete(task)}
              data-testid={`toggle-task-${task.id}`}
            >
              {task.completed ? 'Reopen' : 'Complete'}
            </Button>
            <Menu>
              <MenuTrigger>
                <Button
                  size="small"
                  appearance="subtle"
                  icon={<MoreVertical20Regular />}
                  data-testid={`task-menu-${task.id}`}
                />
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem
                    icon={<Clock20Regular />}
                    onClick={() => handleLogTime(task)}
                    data-testid={`log-time-${task.id}`}
                  >
                    Zeit verbuchen
                  </MenuItem>
                  <MenuItem
                    icon={<Edit20Regular />}
                    onClick={() => handleEdit(task)}
                    data-testid={`edit-task-${task.id}`}
                  >
                    Edit
                  </MenuItem>
                  <MenuItem
                    icon={<Delete20Regular />}
                    onClick={() => handleDelete(task.id)}
                    data-testid={`delete-task-${task.id}`}
                  >
                    Delete
                  </MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>
        </TableCellLayout>
      ),
    }),
  ]

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <CardHeader
          header={
            <div className={styles.header}>
              <div>
                <Text size={500} weight="semibold">
                  Task Management
                </Text>
                <Text size={200} style={{ display: 'block', marginTop: '4px' }}>
                  {stats.total} total • {stats.pending} pending • {stats.completed} completed
                </Text>
              </div>
              <Button
                appearance="primary"
                icon={<Add24Regular />}
                onClick={handleCreate}
                data-testid="create-task-button"
              >
                New Task
              </Button>
            </div>
          }
        />

        <div className={styles.filterBar}>
          <ToggleButton
            checked={filter === 'all'}
            onClick={() => setFilter('all')}
            data-testid="filter-all"
          >
            All
          </ToggleButton>
          <ToggleButton
            checked={filter === 'pending'}
            onClick={() => setFilter('pending')}
            data-testid="filter-pending"
          >
            Pending
          </ToggleButton>
          <ToggleButton
            checked={filter === 'completed'}
            onClick={() => setFilter('completed')}
            data-testid="filter-completed"
          >
            Completed
          </ToggleButton>
          
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Text style={{ color: 'var(--text-color)' }}>Sort by:</Text>
            <ToggleButton
              checked={sortBy === 'date'}
              onClick={() => setSortBy('date')}
              data-testid="sort-date"
            >
              Date
            </ToggleButton>
            <ToggleButton
              checked={sortBy === 'title'}
              onClick={() => setSortBy('title')}
              data-testid="sort-title"
            >
              Title
            </ToggleButton>
            <ToggleButton
              checked={sortBy === 'status'}
              onClick={() => setSortBy('status')}
              data-testid="sort-status"
            >
              Status
            </ToggleButton>
            <ToggleButton
              checked={sortBy === 'priority'}
              onClick={() => setSortBy('priority')}
              data-testid="sort-priority"
            >
              Priority
            </ToggleButton>
          </div>
        </div>

        {loading ? (
          <div className={styles.emptyState}>
            <Spinner label="Loading tasks..." />
          </div>
        ) : error ? (
          <div className={styles.emptyState}>
            <Text>Error: {error}</Text>
          </div>
        ) : tasks.length === 0 ? (
          <div className={styles.emptyState} data-testid="empty-state">
            <Text size={400}>No tasks found</Text>
            <Text size={200} style={{ marginTop: '8px' }}>
              Create your first task to get started
            </Text>
          </div>
        ) : (
          <DataGrid
            items={sortedTasks}
            columns={columns}
            sortable
            getRowId={(item) => item.id}
          >
            <DataGridHeader>
              <DataGridRow>
                {({ renderHeaderCell }) => (
                  <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
                )}
              </DataGridRow>
            </DataGridHeader>
            <DataGridBody>
              {({ item, rowId }) => (
                <DataGridRow key={rowId}>
                  {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                </DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>
        )}
      </Card>

      <TaskDialog
        open={dialogOpen}
        task={editingTask}
        onClose={handleDialogClose}
      />
      
      <TimeLogDialog
        open={timeLogDialogOpen}
        task={timeLogTask}
        onClose={handleTimeLogClose}
      />
    </div>
  )
}
