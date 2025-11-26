/**
 * TaskCard Component
 *
 * Displays a task card with expand/collapse functionality
 * Shows status, title, description, created date, and actions when expanded
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
  Button,
  makeStyles,
  tokens,
  Badge,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
} from '@fluentui/react-components'
import {
  CalendarLtr20Regular,
  Clock20Regular,
  Edit20Regular,
  Delete20Regular,
  ChevronDown20Regular,
  ChevronUp20Regular,
  MoreVertical20Regular
} from '@fluentui/react-icons'

const useStyles = makeStyles({
  card: {
    cursor: 'move',
    transition: 'all 0.2s ease',
    '&:hover': {
      boxShadow: tokens.shadow8,
    },
  },
  cardDragging: {
    opacity: 0.5,
  },
  cardContent: {
    padding: tokens.spacingVerticalM,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: tokens.spacingVerticalS,
  },
  title: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    flex: 1,
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
  },
  expandedContent: {
    marginTop: tokens.spacingVerticalM,
    paddingTop: tokens.spacingVerticalM,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  description: {
    marginTop: tokens.spacingVerticalS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  statusBadge: {
    marginBottom: tokens.spacingVerticalS,
  },
  dates: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalS,
  },
})

// ============================================================================
// CALCULATIONS - Pure functions
// ============================================================================

function formatDate(isoString) {
  if (!isoString) return '—'
  const date = new Date(isoString)
  return date.toLocaleDateString()
}

function formatDateTime(isoString) {
  if (!isoString) return '—'
  const date = new Date(isoString)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

function getStatusLabel(status) {
  const labels = {
    todo: 'To Do',
    in_progress: 'In Progress',
    done: 'Done',
  }
  return labels[status] || status
}

function getStatusColor(status) {
  const colors = {
    todo: 'warning',
    in_progress: 'important',
    done: 'success',
  }
  return colors[status] || 'informative'
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function TaskCard({
  task,
  onDragStart,
  onDragEnd,
  onClick,
  onEdit,
  onDelete,
  isDragging,
}) {
  const styles = useStyles()
  const [isExpanded, setIsExpanded] = useState(false)

  const handleCardClick = (e) => {
    // Don't expand if clicking on action buttons
    if (e.target.closest('button')) {
      return
    }
    setIsExpanded(!isExpanded)
    if (onClick) {
      onClick(task)
    }
  }

  const handleEdit = (e) => {
    e.stopPropagation()
    if (onEdit) {
      onEdit(task)
    }
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    if (onDelete) {
      onDelete(task)
    }
  }

  return (
    <Card
      className={`${styles.card} ${isDragging ? styles.cardDragging : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className={styles.cardContent}>
        <div className={styles.cardHeader}>
          <Text className={styles.title} onClick={handleCardClick}>
            {task.title}
          </Text>
          <div className={styles.actions}>
            <Button
              appearance="subtle"
              icon={isExpanded ? <ChevronUp20Regular /> : <ChevronDown20Regular />}
              onClick={handleCardClick}
              size="small"
            />
            {(onEdit || onDelete) && (
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <Button
                    appearance="subtle"
                    icon={<MoreVertical20Regular />}
                    size="small"
                    onClick={(e) => e.stopPropagation()}
                  />
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    {onEdit && (
                      <MenuItem icon={<Edit20Regular />} onClick={handleEdit}>
                        Edit
                      </MenuItem>
                    )}
                    {onDelete && (
                      <MenuItem icon={<Delete20Regular />} onClick={handleDelete}>
                        Delete
                      </MenuItem>
                    )}
                  </MenuList>
                </MenuPopover>
              </Menu>
            )}
          </div>
        </div>

        {/* Compact view - always visible */}
        {(task.start_date || task.end_date) && !isExpanded && (
          <div className={styles.detailRow}>
            <CalendarLtr20Regular />
            <Text>
              {formatDate(task.start_date)} - {formatDate(task.end_date)}
            </Text>
          </div>
        )}

        {/* Expanded view */}
        {isExpanded && (
          <div className={styles.expandedContent}>
            <div className={styles.statusBadge}>
              <Badge appearance="filled" color={getStatusColor(task.status)}>
                {getStatusLabel(task.status)}
              </Badge>
            </div>

            {task.description && (
              <div className={styles.description}>
                <Text weight="semibold">Description:</Text>
                <br />
                <Text>{task.description}</Text>
              </div>
            )}

            <div className={styles.dates}>
              <div className={styles.detailRow}>
                <CalendarLtr20Regular />
                <Text>
                  <strong>Start:</strong> {formatDate(task.start_date)}
                </Text>
              </div>
              <div className={styles.detailRow}>
                <CalendarLtr20Regular />
                <Text>
                  <strong>End:</strong> {formatDate(task.end_date)}
                </Text>
              </div>
              <div className={styles.detailRow}>
                <Clock20Regular />
                <Text>
                  <strong>Created:</strong> {formatDateTime(task.created_at)}
                </Text>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
