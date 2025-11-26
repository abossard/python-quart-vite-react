/**
 * KanbanBoard Component
 *
 * Displays tasks in a Kanban board with drag-and-drop functionality
 * Columns: To Do, In Progress, Done
 *
 * Following principles:
 * - Pure functions for data transformations (calculations)
 * - Side effects isolated in event handlers (actions)
 * - Clear component interface
 */

import { useState } from 'react'
import {
  Card,
  Text,
  makeStyles,
  tokens,
  Badge,
} from '@fluentui/react-components'
import {
  CalendarLtr20Regular,
} from '@fluentui/react-icons'
import TaskCard from './TaskCard'

const useStyles = makeStyles({
  board: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: tokens.spacingHorizontalL,
    padding: tokens.spacingVerticalL,
    height: '100%',
    overflow: 'hidden',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusLarge,
    padding: tokens.spacingVerticalM,
    minHeight: '500px',
    maxHeight: 'calc(100vh - 250px)',
  },
  columnHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalS,
    borderBottom: `2px solid ${tokens.colorNeutralStroke1}`,
  },
  columnTitle: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
  },
  columnCards: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    overflowY: 'auto',
    flex: 1,
  },
  dragOver: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderColor: tokens.colorBrandBackground,
    borderWidth: '2px',
    borderStyle: 'dashed',
  },
})

// ============================================================================
// CALCULATIONS - Pure functions
// ============================================================================

function getTasksByStatus(tasks, status) {
  return tasks.filter((task) => task.status === status)
}

const COLUMNS = [
  { id: 'todo', title: 'To Do', status: 'todo', color: 'warning' },
  { id: 'in_progress', title: 'In Progress', status: 'in_progress', color: 'important' },
  { id: 'done', title: 'Done', status: 'done', color: 'success' },
]

// ============================================================================
// COMPONENT
// ============================================================================

export default function KanbanBoard({ tasks, onTaskUpdate, onTaskClick, onTaskEdit, onTaskDelete }) {
  const styles = useStyles()
  const [draggedTask, setDraggedTask] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)

  // Drag handlers
  const handleDragStart = (task) => {
    setDraggedTask(task)
  }

  const handleDragEnd = () => {
    setDraggedTask(null)
    setDragOverColumn(null)
  }

  const handleDragOver = (e, columnStatus) => {
    e.preventDefault()
    setDragOverColumn(columnStatus)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = async (e, columnStatus) => {
    e.preventDefault()
    setDragOverColumn(null)

    if (draggedTask && draggedTask.status !== columnStatus) {
      // Update task status
      const updates = { status: columnStatus }
      
      // Auto-complete task when moved to Done
      if (columnStatus === 'done') {
        updates.completed = true
      } else if (draggedTask.completed) {
        updates.completed = false
      }

      await onTaskUpdate(draggedTask.id, updates)
    }

    setDraggedTask(null)
  }

  return (
    <div className={styles.board}>
      {COLUMNS.map((column) => {
        const columnTasks = getTasksByStatus(tasks, column.status)

        return (
          <div
            key={column.id}
            className={`${styles.column} ${dragOverColumn === column.status ? styles.dragOver : ''}`}
            onDragOver={(e) => handleDragOver(e, column.status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.status)}
          >
            <div className={styles.columnHeader}>
              <Text className={styles.columnTitle}>{column.title}</Text>
              <Badge appearance="filled" color={column.color}>
                {columnTasks.length}
              </Badge>
            </div>

            <div className={styles.columnCards}>
              {columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onDragStart={() => handleDragStart(task)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onTaskClick && onTaskClick(task)}
                  onEdit={onTaskEdit ? () => onTaskEdit(task) : undefined}
                  onDelete={onTaskDelete ? () => onTaskDelete(task.id) : undefined}
                  isDragging={draggedTask?.id === task.id}
                />
              ))}

              {columnTasks.length === 0 && (
                <Text style={{ textAlign: 'center', color: tokens.colorNeutralForeground3, padding: tokens.spacingVerticalXXL }}>
                  No tasks
                </Text>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
