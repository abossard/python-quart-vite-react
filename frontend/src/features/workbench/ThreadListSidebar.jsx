/**
 * Thread List Sidebar
 *
 * Shows past conversations for an agent with resume/delete functionality.
 * Calculation-heavy: renders data from API, minimal side effects.
 */

import {
  Button,
  Card,
  makeStyles,
  Spinner,
  Text,
  tokens,
} from '@fluentui/react-components'
import {
  Add24Regular,
  Chat24Regular,
  Delete24Regular,
} from '@fluentui/react-icons'
import { useCallback, useEffect, useState } from 'react'
import { deleteThread, listThreads } from '../../services/api'

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  threadItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground3,
    },
  },
  threadItemSelected: {
    backgroundColor: tokens.colorBrandBackground2,
  },
  threadTitle: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  threadTime: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
  },
  empty: {
    padding: '16px',
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
})

/**
 * Relative time calculation (pure).
 */
function timeAgo(dateStr) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const seconds = Math.floor((now - then) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default function ThreadListSidebar({
  agentId,
  selectedThreadId,
  onSelectThread,
  onNewConversation,
}) {
  const styles = useStyles()
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(false)

  const loadThreads = useCallback(async () => {
    if (!agentId) return
    setLoading(true)
    try {
      const data = await listThreads(agentId)
      setThreads(data.threads || [])
    } catch {
      setThreads([])
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    loadThreads()
  }, [loadThreads])

  const handleDelete = useCallback(async (e, threadId) => {
    e.stopPropagation()
    try {
      await deleteThread(threadId)
      setThreads(prev => prev.filter(t => t.id !== threadId))
      if (selectedThreadId === threadId) {
        onSelectThread?.(null)
      }
    } catch {
      // ignore
    }
  }, [selectedThreadId, onSelectThread])

  return (
    <div className={styles.container} data-testid="thread-list-sidebar">
      <div className={styles.header}>
        <Text weight="semibold" size={300}>Conversations</Text>
        <Button
          appearance="subtle"
          size="small"
          icon={<Add24Regular />}
          onClick={onNewConversation}
          data-testid="thread-new-conversation"
        >
          New
        </Button>
      </div>

      {loading && <Spinner size="tiny" />}

      {!loading && threads.length === 0 && (
        <div className={styles.empty} data-testid="thread-list-empty">
          <Chat24Regular style={{ display: 'block', margin: '0 auto 8px' }} />
          <Text size={200}>No conversations yet</Text>
        </div>
      )}

      {threads.map(thread => (
        <div
          key={thread.id}
          className={`${styles.threadItem} ${thread.id === selectedThreadId ? styles.threadItemSelected : ''}`}
          onClick={() => onSelectThread?.(thread.id)}
          data-testid={`thread-entry-${thread.id}`}
        >
          <div className={styles.threadTitle}>
            <Text size={200} weight={thread.id === selectedThreadId ? 'semibold' : 'regular'}>
              {thread.title || 'Untitled conversation'}
            </Text>
            <div className={styles.threadTime}>{timeAgo(thread.updated_at)}</div>
          </div>
          <Button
            appearance="subtle"
            size="small"
            icon={<Delete24Regular />}
            onClick={(e) => handleDelete(e, thread.id)}
            data-testid={`thread-delete-${thread.id}`}
          />
        </div>
      ))}
    </div>
  )
}
