/**
 * Conversation Panel
 *
 * AG-UI powered chat component for conversational agent interaction.
 * Opens from agent card "Chat" button or from clicking a completed run.
 *
 * Action: manages SSE connection to /api/workbench/ag-ui,
 * persists thread state, renders tool call results with widgets.
 */

import {
  Button,
  Divider,
  makeStyles,
  Spinner,
  Text,
  Textarea,
  tokens,
} from '@fluentui/react-components'
import {
  Dismiss24Regular,
  Send24Regular,
} from '@fluentui/react-icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MarkdownWidget,
  StructuredOutputRenderer,
} from './toolRenders'

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: tokens.colorNeutralBackground1,
    borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
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
    maxWidth: '90%',
    overflow: 'auto',
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
  streamingDot: {
    display: 'inline-block',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: tokens.colorBrandForeground1,
    animation: 'pulse 1s infinite',
  },
})

/**
 * Parse SSE data lines from a text chunk, returning parsed events
 * and any remaining incomplete line.
 * Calculation: (text, remainder) → { events, remainder }
 */
function parseSSEChunk(text, prevRemainder = '') {
  const events = []
  const combined = prevRemainder + text
  const lines = combined.split('\n')
  // Last line may be incomplete — keep it as remainder
  const remainder = lines.pop() || ''
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('data: ')) {
      try {
        events.push(JSON.parse(trimmed.slice(6)))
      } catch {
        // Skip malformed lines
      }
    }
  }
  return { events, remainder }
}

export default function ConversationPanel({
  agentId,
  agentName,
  threadId: initialThreadId,
  initialMessages = [],
  onClose,
  outputSchema,
}) {
  const styles = useStyles()
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [threadId, setThreadId] = useState(initialThreadId || null)
  const messagesEndRef = useRef(null)
  const abortRef = useRef(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load existing thread messages
  useEffect(() => {
    if (initialThreadId && initialMessages.length === 0) {
      fetch(`/api/workbench/threads/${initialThreadId}`)
        .then(r => r.json())
        .then(data => {
          if (data.messages) {
            setMessages(data.messages.map(m => ({
              role: m.role,
              content: m.content,
              id: m.id,
            })))
          }
        })
        .catch(() => {})
    }
  }, [initialThreadId])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text, id: `user-${Date.now()}` }])
    setIsStreaming(true)

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      const response = await fetch('/api/workbench/ag-ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agentId,
          thread_id: threadId,
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
            case 'RUN_STARTED':
              if (event.threadId && !threadId) {
                setThreadId(event.threadId)
              }
              break

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
                return [...prev, {
                  role: 'assistant',
                  content: assistantContent,
                  id: currentMessageId,
                }]
              })
              break

            case 'TEXT_MESSAGE_END':
              break

            case 'TOOL_CALL_START':
              setMessages(prev => [...prev, {
                role: 'tool_call',
                content: `🔧 ${event.toolCallName || 'tool'}`,
                id: `tc-${event.toolCallId}`,
                toolCallId: event.toolCallId,
              }])
              break

            case 'TOOL_CALL_ARGS':
              setMessages(prev => prev.map(m =>
                m.id === `tc-${event.toolCallId}`
                  ? { ...m, content: `🔧 ${m.content.replace('🔧 ', '')} — ${event.delta?.substring(0, 100)}` }
                  : m
              ))
              break

            case 'TOOL_CALL_RESULT':
              setMessages(prev => prev.map(m =>
                m.id === `tc-${event.toolCallId}`
                  ? { ...m, content: `✅ ${m.content.replace('🔧 ', '').replace('✅ ', '')}`, result: event.content }
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

            case 'RUN_FINISHED':
              break
          }
        }
      }

      // If structured output was received, add it as a message
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
  }, [input, isStreaming, agentId, threadId])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }, [sendMessage])

  return (
    <div className={styles.container} data-testid="conversation-panel">
      {/* Header */}
      <div className={styles.header}>
        <Text weight="semibold" size={400} data-testid="conversation-panel-title">
          💬 {agentName || 'Agent Chat'}
        </Text>
        {onClose && (
          <Button
            appearance="subtle"
            icon={<Dismiss24Regular />}
            onClick={onClose}
            size="small"
            data-testid="conversation-panel-close"
          />
        )}
      </div>

      {/* Messages */}
      <div className={styles.messages} data-testid="conversation-messages">
        {messages.map((msg) => {
          if (msg.role === 'user') {
            return <div key={msg.id} className={styles.userMessage} data-testid="chat-message-user">{msg.content}</div>
          }
          if (msg.role === 'assistant') {
            return (
              <div key={msg.id} className={styles.assistantMessage} data-testid="chat-message-assistant">
                <MarkdownWidget content={msg.content} />
              </div>
            )
          }
          if (msg.role === 'tool_call') {
            return <div key={msg.id} className={styles.toolCallMessage} data-testid="chat-message-tool">{msg.content}</div>
          }
          if (msg.role === 'structured') {
            return (
              <div key={msg.id} className={styles.assistantMessage} data-testid="chat-message-structured">
                <StructuredOutputRenderer
                  output={msg.content?.output}
                  schema={msg.content?.schema || outputSchema}
                />
              </div>
            )
          }
          if (msg.role === 'error') {
            return (
              <div key={msg.id} className={styles.assistantMessage} data-testid="chat-message-error" style={{ color: tokens.colorPaletteRedForeground1 }}>
                {msg.content}
              </div>
            )
          }
          return null
        })}
        {isStreaming && (
          <div data-testid="chat-streaming-indicator" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px' }}>
            <Spinner size="tiny" />
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Agent is thinking...</Text>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={styles.inputArea}>
        <Textarea
          className={styles.textarea}
          placeholder="Type a message..."
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
    </div>
  )
}
