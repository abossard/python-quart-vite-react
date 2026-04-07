/**
 * ActivityPage — Real-time Agent Activity Monitor
 *
 * Connects to SSE endpoint to display live agent events:
 * run lifecycle, LLM thinking, tool calls, errors.
 *
 * Supports filtering by run_id via URL query param: /activity?run_id=xxx
 */

import {
    Badge,
    Body1,
    Button,
    Caption1,
    Card,
    Subtitle2,
    Text,
    Tooltip,
    makeStyles,
    tokens,
} from '@fluentui/react-components'
import {
    ArrowClockwise24Regular,
    ChevronDown20Regular,
    ChevronRight20Regular,
    Delete24Regular,
    Dismiss24Regular,
} from '@fluentui/react-icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { subscribeSSE, SSE_STATE } from '../../agent-builder-ui/services/agentSSE'
import { formatTime, shortId, eventSummary, eventDetail } from '../../agent-builder-ui/utils/eventFormatters'

const MAX_EVENTS = 500

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  connected: {
    backgroundColor: tokens.colorPaletteGreenBackground3,
    boxShadow: `0 0 6px ${tokens.colorPaletteGreenBackground3}`,
  },
  disconnected: {
    backgroundColor: tokens.colorPaletteRedBackground3,
  },
  eventList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    fontFamily: 'monospace',
    fontSize: '13px',
    maxHeight: 'calc(100vh - 240px)',
    overflowY: 'auto',
    padding: tokens.spacingVerticalS,
  },
  eventRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalS,
    padding: '4px 8px',
    borderRadius: tokens.borderRadiusMedium,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  timestamp: {
    color: tokens.colorNeutralForeground4,
    flexShrink: 0,
    fontSize: '12px',
    fontFamily: 'monospace',
    minWidth: '85px',
  },
  runId: {
    flexShrink: 0,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: '11px',
  },
  eventContent: {
    flex: 1,
    wordBreak: 'break-word',
  },
  expandBtn: {
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    background: 'none',
    border: 'none',
    padding: 0,
    color: tokens.colorNeutralForeground3,
  },
  detail: {
    marginTop: '4px',
    padding: '6px 10px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    fontSize: '12px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  empty: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground4,
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorBrandBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
})

const EVENT_CONFIG = {
  RUN_STARTED:      { emoji: '🚀', color: 'informative', label: 'Run Started' },
  RUN_FINISHED:     { emoji: '✅', color: 'success',     label: 'Run Completed' },
  RUN_ERROR:        { emoji: '❌', color: 'danger',      label: 'Run Failed' },
  STEP_STARTED:     { emoji: '🧠', color: 'warning',     label: 'Step Started' },
  STEP_FINISHED:    { emoji: '💬', color: 'informative', label: 'Step Finished' },
  TOOL_CALL_START:  { emoji: '🔧', color: 'warning',     label: 'Tool Call' },
  TOOL_CALL_END:    { emoji: '📦', color: 'success',     label: 'Tool Done' },
  TOOL_CALL_RESULT: { emoji: '📄', color: 'informative', label: 'Tool Result' },
}

function EventRow({ evt, onFilterByRun }) {
  const styles = useStyles()
  const [expanded, setExpanded] = useState(false)
  const evtType = evt.type || evt.event_type || ''
  const evtRunId = evt.runId || evt.run_id || ''
  const config = EVENT_CONFIG[evtType] || { emoji: '❓', color: 'informative', label: evtType }
  const detail = eventDetail(evt)

  return (
    <div className={styles.eventRow} data-testid="activity-event">
      <span className={styles.timestamp}>{formatTime(evt.timestamp)}</span>
      <Tooltip content={`Filter by run ${evtRunId}`} relationship="label">
        <Badge
          appearance="outline"
          color={config.color}
          className={styles.runId}
          onClick={(e) => { e.stopPropagation(); onFilterByRun(evtRunId) }}
        >
          {shortId(evtRunId)}
        </Badge>
      </Tooltip>
      <span>{config.emoji}</span>
      <div className={styles.eventContent}>
        <span>{eventSummary(evt)}</span>
        {detail && (
          <>
            <button
              className={styles.expandBtn}
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronDown20Regular /> : <ChevronRight20Regular />}
            </button>
            {expanded && <div className={styles.detail}>{detail}</div>}
          </>
        )}
      </div>
    </div>
  )
}

export default function ActivityPage() {
  const styles = useStyles()
  const [events, setEvents] = useState([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(null)
  const listRef = useRef(null)
  const cleanupRef = useRef(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const filterRunId = searchParams.get('run_id') || ''

  const setFilterRunId = useCallback((runId) => {
    if (runId) {
      setSearchParams({ run_id: runId })
    } else {
      setSearchParams({})
    }
  }, [setSearchParams])

  const connect = useCallback(() => {
    if (cleanupRef.current) cleanupRef.current()
    setError(null)

    cleanupRef.current = subscribeSSE({
      onEvent: (evt) => {
        setEvents((prev) => {
          const next = [...prev, evt]
          return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next
        })
      },
      onStateChange: (sseState) => {
        setConnected(sseState === SSE_STATE.CONNECTED)
        if (sseState === SSE_STATE.RECONNECTING) {
          setError('Connection lost — reconnecting…')
        } else if (sseState === SSE_STATE.CONNECTED) {
          setError(null)
        }
      },
    })
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (cleanupRef.current) cleanupRef.current()
    }
  }, [connect])

  const filteredEvents = filterRunId
    ? events.filter((e) => (e.runId || e.run_id) === filterRunId)
    : events

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [filteredEvents])

  return (
    <div className={styles.container} data-testid="activity-page">
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Subtitle2>Agent Activity</Subtitle2>
          <Tooltip content={connected ? 'Connected' : 'Disconnected'} relationship="label">
            <span
              className={`${styles.statusDot} ${connected ? styles.connected : styles.disconnected}`}
              data-testid="activity-status"
            />
          </Tooltip>
          <Caption1>{filteredEvents.length}{filterRunId ? ` / ${events.length}` : ''} events</Caption1>
          {error && <Text style={{ color: tokens.colorPaletteRedForeground1 }}>{error}</Text>}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            appearance="subtle"
            icon={<ArrowClockwise24Regular />}
            onClick={connect}
            data-testid="activity-reconnect"
          >
            Reconnect
          </Button>
          <Button
            appearance="subtle"
            icon={<Delete24Regular />}
            onClick={() => setEvents([])}
            data-testid="activity-clear"
          >
            Clear
          </Button>
        </div>
      </div>

      {filterRunId && (
        <div className={styles.filterBar} data-testid="activity-filter-bar">
          <Text size={200} weight="semibold">Filtered by run:</Text>
          <Badge appearance="filled" color="brand" style={{ fontFamily: 'monospace' }}>
            {shortId(filterRunId)}
          </Badge>
          <Caption1 style={{ fontFamily: 'monospace' }}>{filterRunId}</Caption1>
          <Button
            appearance="subtle"
            icon={<Dismiss24Regular />}
            size="small"
            onClick={() => setFilterRunId('')}
            data-testid="activity-clear-filter"
          >
            Clear filter
          </Button>
        </div>
      )}

      <Card>
        <div className={styles.eventList} ref={listRef} data-testid="activity-event-list">
          {filteredEvents.length === 0 ? (
            <div className={styles.empty}>
              <Body1>
                {filterRunId
                  ? 'No events for this run yet — the run may still be in progress'
                  : 'No events yet — run an agent to see activity here'}
              </Body1>
            </div>
          ) : (
            filteredEvents.map((evt, i) => (
              <EventRow
                key={`${evt.timestamp}-${i}`}
                evt={evt}
                onFilterByRun={setFilterRunId}
              />
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
