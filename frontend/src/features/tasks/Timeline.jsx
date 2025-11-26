/**
 * Timeline Component
 *
 * Displays tasks on a timeline based on start and end dates
 * Visualizes task duration and overlaps
 *
 * Following principles:
 * - Pure functions for data transformations (calculations)
 * - Side effects isolated in event handlers (actions)
 * - Clear component interface
 */

import { useState, useEffect } from 'react'
import {
  Card,
  Text,
  makeStyles,
  tokens,
  Badge,
  Field,
  Input,
  Button,
} from '@fluentui/react-components'
import {
  CalendarLtr20Regular,
  ArrowSync20Regular
} from '@fluentui/react-icons'

const useStyles = makeStyles({
  timeline: {
    padding: tokens.spacingVerticalL,
    overflowX: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalL,
  },
  controls: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'flex-end',
    marginBottom: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  dateInput: {
    minWidth: '150px',
  },
  timelineGrid: {
    position: 'relative',
    minHeight: '400px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusLarge,
    padding: tokens.spacingVerticalL,
  },
  dateAxis: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalS,
    borderBottom: `2px solid ${tokens.colorNeutralStroke1}`,
  },
  dateLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
  },
  tasksContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  taskRow: {
    display: 'flex',
    alignItems: 'center',
    minHeight: '60px',
    position: 'relative',
  },
  taskLabel: {
    width: '200px',
    paddingRight: tokens.spacingHorizontalL,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
  },
  taskBar: {
    position: 'absolute',
    left: '200px',
    height: '40px',
    backgroundColor: tokens.colorBrandBackground,
    borderRadius: tokens.borderRadiusMedium,
    display: 'flex',
    alignItems: 'center',
    padding: `0 ${tokens.spacingHorizontalM}`,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: tokens.colorBrandBackgroundHover,
      boxShadow: tokens.shadow8,
    },
  },
  taskBarTodo: {
    backgroundColor: tokens.colorPaletteYellowBackground3,
    '&:hover': {
      backgroundColor: tokens.colorPaletteYellowBorder1,
    },
  },
  taskBarInProgress: {
    backgroundColor: tokens.colorPaletteBlueBackground3,
    '&:hover': {
      backgroundColor: tokens.colorPaletteBlueBorder1,
    },
  },
  taskBarDone: {
    backgroundColor: tokens.colorPaletteGreenBackground3,
    '&:hover': {
      backgroundColor: tokens.colorPaletteGreenBorder1,
    },
  },
  taskBarText: {
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
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
  if (!isoString) return null
  const date = new Date(isoString)
  return date
}

function getDateRange(tasks) {
  const dates = tasks.flatMap(task => [
    task.start_date ? new Date(task.start_date) : null,
    task.end_date ? new Date(task.end_date) : null,
  ]).filter(Boolean)

  if (dates.length === 0) {
    return { min: new Date(), max: new Date() }
  }

  const min = new Date(Math.min(...dates))
  const max = new Date(Math.max(...dates))

  // Add some padding to the range
  min.setDate(min.getDate() - 1)
  max.setDate(max.getDate() + 1)

  return { min, max }
}

function calculateTaskPosition(task, minDate, maxDate) {
  const start = task.start_date ? new Date(task.start_date) : minDate
  const end = task.end_date ? new Date(task.end_date) : maxDate

  const totalDuration = maxDate - minDate
  const taskStart = start - minDate
  const taskDuration = end - start

  const leftPercent = (taskStart / totalDuration) * 100
  const widthPercent = (taskDuration / totalDuration) * 100

  return {
    left: `calc(200px + ${leftPercent}%)`,
    width: `${widthPercent}%`,
  }
}

function getStatusClass(status, styles) {
  const classes = {
    todo: styles.taskBarTodo,
    in_progress: styles.taskBarInProgress,
    done: styles.taskBarDone,
  }
  return classes[status] || ''
}

function generateDateLabels(minDate, maxDate) {
  const labels = []
  const daysDiff = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24))
  
  if (daysDiff <= 7) {
    // Show each day
    for (let i = 0; i <= daysDiff; i++) {
      const date = new Date(minDate)
      date.setDate(date.getDate() + i)
      labels.push(date.toLocaleDateString('de-DE', { month: 'short', day: 'numeric' }))
    }
  } else {
    // Show start, middle, end
    labels.push(minDate.toLocaleDateString('de-DE', { month: 'short', day: 'numeric' }))
    
    const middle = new Date(minDate.getTime() + (maxDate - minDate) / 2)
    labels.push(middle.toLocaleDateString('de-DE', { month: 'short', day: 'numeric' }))
    
    labels.push(maxDate.toLocaleDateString('de-DE', { month: 'short', day: 'numeric' }))
  }
  
  return labels
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function Timeline({ tasks, onTaskClick }) {
  const styles = useStyles()

  // State for manual date range selection
  const [manualStartDate, setManualStartDate] = useState('')
  const [manualEndDate, setManualEndDate] = useState('')
  const [useManualDates, setUseManualDates] = useState(false)

  // Filter tasks that have dates
  const tasksWithDates = tasks.filter(task => task.start_date || task.end_date)

  // Calculate automatic date range from tasks
  const autoDateRange = getDateRange(tasksWithDates)

  // Initialize manual dates when tasks change (only if not manually set)
  useEffect(() => {
    if (tasksWithDates.length > 0 && !useManualDates) {
      const { min, max } = autoDateRange
      setManualStartDate(min.toISOString().split('T')[0])
      setManualEndDate(max.toISOString().split('T')[0])
    }
  }, [tasksWithDates.length])

  // Determine which date range to use
  const getEffectiveDateRange = () => {
    if (useManualDates && manualStartDate && manualEndDate) {
      return {
        min: new Date(manualStartDate),
        max: new Date(manualEndDate),
      }
    }
    return autoDateRange
  }

  const handleResetDates = () => {
    setUseManualDates(false)
    const { min, max } = autoDateRange
    setManualStartDate(min.toISOString().split('T')[0])
    setManualEndDate(max.toISOString().split('T')[0])
  }

  const handleApplyManualDates = () => {
    if (manualStartDate && manualEndDate) {
      setUseManualDates(true)
    }
  }

  if (tasksWithDates.length === 0) {
    return (
      <div className={styles.timeline}>
        <div className={styles.emptyState}>
          <CalendarLtr20Regular style={{ fontSize: '48px', marginBottom: tokens.spacingVerticalL }} />
          <Text size={400}>No tasks with dates to display</Text>
          <br />
          <Text size={200}>Add start and end dates to tasks to see them on the timeline</Text>
        </div>
      </div>
    )
  }

  const { min: minDate, max: maxDate } = getEffectiveDateRange()
  const dateLabels = generateDateLabels(minDate, maxDate)

  return (
    <div className={styles.timeline}>
      <div className={styles.header}>
        <Text size={500} weight="semibold">Task Timeline</Text>
        <Badge appearance="filled" color="informative">
          {tasksWithDates.length} {tasksWithDates.length === 1 ? 'task' : 'tasks'}
        </Badge>
      </div>

      <div className={styles.controls}>
        <Field label="Start Date" className={styles.dateInput}>
          <Input
            type="date"
            value={manualStartDate}
            onChange={(e) => {
              setManualStartDate(e.target.value)
              setUseManualDates(false)
            }}
          />
        </Field>

        <Field label="End Date" className={styles.dateInput}>
          <Input
            type="date"
            value={manualEndDate}
            onChange={(e) => {
              setManualEndDate(e.target.value)
              setUseManualDates(false)
            }}
          />
        </Field>

        <Button
          appearance="primary"
          onClick={handleApplyManualDates}
          disabled={!manualStartDate || !manualEndDate}
        >
          Apply Period
        </Button>

        <Button
          appearance="secondary"
          icon={<ArrowSync20Regular />}
          onClick={handleResetDates}
          disabled={!useManualDates}
        >
          Reset
        </Button>

        {useManualDates && (
          <Badge color="success" appearance="tint">
            Custom Period
          </Badge>
        )}
      </div>

      <div className={styles.timelineGrid}>
        <div className={styles.dateAxis}>
          {dateLabels.map((label, index) => (
            <Text key={index} className={styles.dateLabel}>
              {label}
            </Text>
          ))}
        </div>

        <div className={styles.tasksContainer}>
          {tasksWithDates.map((task) => {
            const position = calculateTaskPosition(task, minDate, maxDate)
            const statusClass = getStatusClass(task.status, styles)

            return (
              <div key={task.id} className={styles.taskRow}>
                <div className={styles.taskLabel}>
                  <Text>{task.title}</Text>
                </div>
                <div
                  className={`${styles.taskBar} ${statusClass}`}
                  style={{
                    left: position.left,
                    width: position.width,
                  }}
                  onClick={() => onTaskClick && onTaskClick(task)}
                >
                  <Text className={styles.taskBarText}>
                    {task.title}
                  </Text>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
