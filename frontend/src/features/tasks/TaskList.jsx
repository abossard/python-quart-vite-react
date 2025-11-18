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
} from '@fluentui/react-icons'
import { getTasks, deleteTask, updateTask } from '../../services/api'
import TaskDialog from './TaskDialog'

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
  },
  card: {
    maxWidth: '1200px',
    margin: '0 auto',
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
    color: tokens.colorNeutralForeground3,
  },
})

// ============================================================================
// CALCULATIONS - Pure functions
// ============================================================================

function formatDate(isoString) {
  const date = new Date(isoString)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

function getTaskStats(tasks) {
  return {
    total: tasks.length,
    completed: tasks.filter((t) => t.completed).length,
    pending: tasks.filter((t) => !t.completed).length,
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
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)

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

  // Calculate stats
  const stats = getTaskStats(tasks)

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
            items={tasks}
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
    </div>
  )
}
