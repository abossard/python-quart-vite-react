/**
 * RunConversationModal — Unified conversation modal for agent runs.
 *
 * Handles all run states in one chat-style modal:
 * - Running: live SSE activity events stream in as real-time messages
 * - Completed/Truncated: activity_log from server rendered as step-by-step detail
 * - Failed: error shown, user can still chat
 *
 * Uses activity events from useRunManager (single SSE subscription).
 * No duplicate SSE connections.
 *
 * Data: run object, activity events, agent info
 * Calculation: event-to-message conversion, output parsing
 * Action: AG-UI thread continuation
 */

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  Textarea,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { Dismiss24Regular, Send24Regular } from '@fluentui/react-icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createThreadFromRun } from '../../services/api'
import { parseRunOutput } from '../../agent-builder-ui'
import SchemaRenderer from './SchemaRenderer'
import { SmartMessageRenderer } from './toolRenders'

const useStyles = makeStyles({
  surface: {
    maxWidth: '90vw',
    width: '90vw',
    maxHeight: '90vh',
    height: '90vh',
    display: 'flex',
    flexDirection: 'column',
  },
  body: {
    flex: '1 1 auto',
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    flex: '1 1 auto',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  messages: {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    padding: '8px 14px',
    borderRadius: '12px 12px 2px 12px',
    maxWidth: '80%',
    whiteSpace: 'pre-wrap',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colorNeutralBackground3,
    padding: '10px 14px',
    borderRadius: '12px 12px 12px 2px',
    maxWidth: '95%',
  },
  toolCallMessage: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colorNeutralBackground2,
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontFamily: 'monospace',
    color: tokens.colorNeutralForeground3,
    maxWidth: '80%',
  },
  errorMessage: {
    alignSelf: 'flex-start',
    padding: '8px 14px',
    borderRadius: '8px',
    maxWidth: '80%',
  },
  inputArea: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    alignItems: 'flex-end',
  },
  textarea: {
    flex: 1,
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    fontSize: '12px',
  },
})

/**
 * Parse SSE data lines with remainder handling.
 * Calculation: (text, remainder) → { events, remainder }
 */
function parseSSEChunk(text, prevRemainder = '') {
  const events = []
  const combined = prevRemainder + text
  const lines = combined.split('\n')
  const remainder = lines.pop() || ''
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('data: ')) {
      try {
        events.push(JSON.parse(trimmed.slice(6)))
      } catch { /* skip malformed */ }
    }
  }
  return { events, remainder }
}

/**
 * Try to parse run output as structured data for SchemaRenderer.
 * Calculation: string → object | null
 */
function tryParseStructured(output) {
  if (!output || typeof output !== 'string') return null
  try {
    const parsed = JSON.parse(output)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed
    }
  } catch { /* not JSON */ }
  return null
}

// ---------------------------------------------------------------------------
// Activity event → message conversion (Calculation: events[] → messages[])
// ---------------------------------------------------------------------------

const EVENT_CONFIG = {
  RUN_STARTED:      { emoji: '🚀', label: 'Agent started' },
  RUN_FINISHED:     { emoji: '✅', label: 'Run completed' },
  RUN_ERROR:        { emoji: '❌', label: 'Run failed' },
  STEP_STARTED:     { emoji: '🧠', label: 'Thinking' },
  STEP_FINISHED:    { emoji: '💬', label: 'LLM response' },
  TOOL_CALL_START:  { emoji: '🔧', label: 'Tool call' },
  TOOL_CALL_END:    { emoji: '✅', label: 'Tool done' },
  TOOL_CALL_RESULT: { emoji: '📦', label: 'Tool result' },
}

function activityEventToMessage(event, index) {
  const config = EVENT_CONFIG[event.type] || EVENT_CONFIG[event.event_type] || { emoji: '📋', label: 'Event' }
  const type = event.type || event.event_type
  const data = event.data || event

  let content = `${config.emoji} ${config.label}`
  const parts = []

  switch (type) {
    case 'STEP_STARTED':
      if (data.model) parts.push(`model: ${data.model}`)
      content = `${config.emoji} Thinking${parts.length ? ' (' + parts.join(', ') + ')' : ''}…`
      break
    case 'STEP_FINISHED': {
      if (data.durationMs) parts.push(`${data.durationMs}ms`)
      const tokenCount = data.tokenUsage?.total_tokens || data.tokenUsage?.totalTokens
      if (tokenCount) parts.push(`${tokenCount} tokens`)
      if (data.finishReason) parts.push(data.finishReason)
      if (data.error) parts.push(`⚠️ ${data.error}`)
      content = `💬 LLM response${parts.length ? ' — ' + parts.join(' · ') : ''}`
      break
    }
    case 'TOOL_CALL_START':
      content = `🔧 ${data.toolCallName || 'tool'}${data.args ? ' — ' + String(data.args).substring(0, 120) : ''}`
      break
    case 'TOOL_CALL_END': {
      const name = data.toolCallName || 'tool'
      const suffix = data.durationMs ? ` (${data.durationMs}ms)` : ''
      const errSuffix = data.error ? ` ⚠️ ${data.error}` : ''
      content = `✅ ${name}${suffix}${errSuffix}`
      break
    }
    case 'TOOL_CALL_RESULT':
      if (data.content) {
        const name = data.toolCallName || 'result'
        content = `📦 ${name} → ${String(data.content).substring(0, 150)}${String(data.content).length > 150 ? '…' : ''}`
      }
      break
    case 'RUN_FINISHED': {
      if (data.durationMs) parts.push(`${data.durationMs}ms`)
      if (data.toolsUsed?.length) parts.push(`tools: ${data.toolsUsed.join(', ')}`)
      if (data.truncated) parts.push('⚠️ truncated')
      content = `✅ Run completed${parts.length ? ' — ' + parts.join(' · ') : ''}`
      break
    }
    case 'RUN_ERROR':
      content = `❌ ${data.message || 'Run failed'}`
      break
  }

  return {
    role: 'activity',
    content,
    id: `activity-${index}-${type}`,
  }
}

function buildMessagesFromRun(run, activityEvents) {
  const messages = []

  // User prompt
  const prompt = run.input_prompt || run.agent_snapshot?.composed_user_message
  if (prompt) {
    messages.push({
      role: 'user',
      content: prompt,
      id: `seed-user-${run.id}`,
    })
  }

  // Activity events (tool calls, steps, etc.)
  const events = activityEvents.length > 0 ? activityEvents : (run.activity_log || [])
  for (let i = 0; i < events.length; i++) {
    const evt = events[i]
    const type = evt.type || evt.event_type
    // Skip RUN_STARTED and RUN_FINISHED from activity messages (they're structural)
    if (type === 'RUN_STARTED') continue
    if (type === 'RUN_FINISHED') continue
    if (type === 'RUN_ERROR') continue
    messages.push(activityEventToMessage(evt, i))
  }

  // Output / error
  if (run.status === 'completed' || run.status === 'truncated') {
    if (run.output) {
      const structured = tryParseStructured(run.output)
      if (structured) {
        messages.push({
          role: 'structured',
          content: structured,
          id: `seed-output-${run.id}`,
        })
      } else {
        messages.push({
          role: 'assistant',
          content: run.output,
          id: `seed-output-${run.id}`,
        })
      }
    }
    if (run.status === 'truncated') {
      messages.push({
        role: 'warning',
        content: '⚠️ Agent needed more steps to complete. Try increasing the recursion limit in the agent settings.',
        id: `seed-truncated-${run.id}`,
      })
    }
  } else if (run.status === 'failed') {
    messages.push({
      role: 'error',
      content: `❌ ${run.error || 'Run failed'}`,
      id: `seed-error-${run.id}`,
    })
  }

  return messages
}

export default function RunConversationModal({
  open,
  run,
  agentId,
  agentName,
  outputSchema,
  activityEvents = [],
  runState,
  onClose,
}) {
  const styles = useStyles()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [threadId, setThreadId] = useState(null)
  const messagesEndRef = useRef(null)
  const abortRef = useRef(null)
  const initializedRunRef = useRef(null)

  const isRunning = run?.status === 'running' || runState?.status === 'running'
  const isTerminal = run?.status && ['completed', 'failed', 'truncated'].includes(run.status)

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Build messages from run + activity events (reactive to changes)
  useEffect(() => {
    if (!run) return

    // Only rebuild when run or activity events change
    const newMessages = buildMessagesFromRun(run, activityEvents)
    setMessages(newMessages)

    // Track which run we've initialized for
    if (run.id !== initializedRunRef.current) {
      initializedRunRef.current = run.id
      setThreadId(null)
    }
  }, [run?.id, run?.status, run?.output, activityEvents.length])

  // Send follow-up message via AG-UI
  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text, id: `user-${Date.now()}` }])
    setIsStreaming(true)

    // Create thread from run if not yet created
    let currentThreadId = threadId
    if (!currentThreadId && run) {
      try {
        const threadData = await createThreadFromRun(run.id)
        currentThreadId = threadData.id
        setThreadId(currentThreadId)
      } catch (err) {
        setMessages(prev => [...prev, {
          role: 'error',
          content: `❌ Failed to create thread: ${err.message}`,
          id: `err-${Date.now()}`,
        }])
        setIsStreaming(false)
        return
      }
    }

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      const response = await fetch('/api/workbench/ag-ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agentId,
          thread_id: currentThreadId,
          message: text,
        }),
        signal: abortController.signal,
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''
      let currentMessageId = null
      let structuredOutput = null
      let sseRemainder = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const { events, remainder } = parseSSEChunk(chunk, sseRemainder)
        sseRemainder = remainder

        for (const event of events) {
          switch (event.type) {
            case 'TEXT_MESSAGE_START':
              currentMessageId = event.messageId
              assistantContent = ''
              break
            case 'TEXT_MESSAGE_CONTENT':
              assistantContent += event.delta || ''
              setMessages(prev => {
                const existing = prev.find(m => m.id === currentMessageId)
                if (existing) {
                  return prev.map(m =>
                    m.id === currentMessageId ? { ...m, content: assistantContent } : m
                  )
                }
                return [...prev, { role: 'assistant', content: assistantContent, id: currentMessageId }]
              })
              break
            case 'TOOL_CALL_START':
              setMessages(prev => [...prev, {
                role: 'tool_call',
                content: `🔧 ${event.toolCallName || 'tool'}`,
                id: `tc-${event.toolCallId}`,
              }])
              break
            case 'TOOL_CALL_END':
              setMessages(prev => prev.map(m =>
                m.id === `tc-${event.toolCallId}`
                  ? { ...m, content: m.content.replace('🔧', '✅') }
                  : m
              ))
              break
            case 'CUSTOM':
              if (event.name === 'structured_output') {
                structuredOutput = event.value
              }
              break
            case 'RUN_ERROR':
              setMessages(prev => [...prev, {
                role: 'error',
                content: `❌ ${event.message}`,
                id: `err-${Date.now()}`,
              }])
              break
          }
        }
      }

      if (structuredOutput) {
        setMessages(prev => [...prev, {
          role: 'structured',
          content: structuredOutput,
          id: `struct-${Date.now()}`,
        }])
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, {
          role: 'error',
          content: `❌ ${err.message}`,
          id: `err-${Date.now()}`,
        }])
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [input, isStreaming, agentId, threadId, run])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }, [sendMessage])

  const handleClose = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    initializedRunRef.current = null
    setMessages([])
    setThreadId(null)
    onClose?.()
  }, [onClose])

  return (
    <Dialog open={open} onOpenChange={(_, data) => { if (!data.open) handleClose() }}>
      <DialogSurface className={styles.surface}>
        <DialogTitle
          action={
            <Button appearance="subtle" icon={<Dismiss24Regular />} onClick={handleClose} />
          }
        >
          {agentName || 'Agent Run'}
        </DialogTitle>
        <DialogBody className={styles.body}>
          <DialogContent className={styles.content}>
            {/* Messages */}
            <div className={styles.messages} data-testid="run-conversation-messages">
              {messages.map((msg) => {
                if (msg.role === 'user') {
                  return <div key={msg.id} className={styles.userMessage} data-testid="chat-message-user">{msg.content}</div>
                }
                if (msg.role === 'assistant') {
                  return (
                    <div key={msg.id} className={styles.assistantMessage} data-testid="chat-message-assistant">
                      <SmartMessageRenderer content={msg.content} schema={outputSchema} />
                    </div>
                  )
                }
                if (msg.role === 'structured') {
                  const parsed = typeof msg.content === 'string' ? tryParseStructured(msg.content) : msg.content
                  const data = parsed?.output || parsed
                  const schema = parsed?.schema || outputSchema
                  return (
                    <div key={msg.id} className={styles.assistantMessage} data-testid="chat-message-structured">
                      <SchemaRenderer data={data} schema={schema || undefined} />
                    </div>
                  )
                }
                if (msg.role === 'tool_call') {
                  return <div key={msg.id} className={styles.toolCallMessage} data-testid="chat-message-tool">{msg.content}</div>
                }
                if (msg.role === 'activity') {
                  return <div key={msg.id} className={styles.toolCallMessage} data-testid="chat-message-activity">{msg.content}</div>
                }
                if (msg.role === 'warning') {
                  return (
                    <div key={msg.id} className={styles.errorMessage} data-testid="chat-message-warning">
                      <MessageBar intent="warning">
                        <MessageBarBody>{msg.content}</MessageBarBody>
                      </MessageBar>
                    </div>
                  )
                }
                if (msg.role === 'error') {
                  return (
                    <div key={msg.id} className={styles.errorMessage} data-testid="chat-message-error">
                      <MessageBar intent="error">
                        <MessageBarBody>{msg.content}</MessageBarBody>
                      </MessageBar>
                    </div>
                  )
                }
                return null
              })}
              {isRunning && messages.length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px' }}>
                  <Spinner size="small" />
                  <Text>Agent is executing...</Text>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Status bar for running */}
            {isRunning && (
              <div className={styles.statusBar} data-testid="run-status-running">
                <Spinner size="extra-tiny" />
                <Text size={200}>Agent is running — results will appear as they arrive</Text>
              </div>
            )}

            {/* Chat input — always visible for completed/failed runs */}
            {!isRunning && (
              <div className={styles.inputArea}>
                <Textarea
                  className={styles.textarea}
                  placeholder="Ask a follow-up question..."
                  value={input}
                  onChange={(_, data) => setInput(data.value)}
                  onKeyDown={handleKeyDown}
                  resize="vertical"
                  disabled={isStreaming}
                  size="medium"
                  data-testid="conversation-input"
                />
                <Button
                  appearance="primary"
                  icon={<Send24Regular />}
                  onClick={sendMessage}
                  disabled={isStreaming || !input.trim()}
                  data-testid="conversation-send"
                />
              </div>
            )}
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
