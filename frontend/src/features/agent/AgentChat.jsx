/**
 * AgentChat Component
 *
 * Chat interface for Azure OpenAI LangGraph Agent
 * Agent has access to task tools and ticket MCP tools
 *
 * Following principles:
 * - Pure functions for message formatting (calculations)
 * - Side effects isolated in event handlers (actions)
 * - Clear separation of concerns
 */

import {
    Badge,
    Button,
    Card,
    CardHeader,
    Field,
    Spinner,
    Tag,
    Text,
    Textarea,
    makeStyles,
    tokens,
} from '@fluentui/react-components'
import {
    Bot24Regular,
    Delete24Regular,
    Person24Regular,
    Send24Regular,
    Wrench20Regular,
} from '@fluentui/react-icons'
import { useEffect, useRef, useState } from 'react'
import { agentChat } from '../../services/api'

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  card: {
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 200px)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  headerControls: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  message: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'flex-start',
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
  },
  messageIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: tokens.borderRadiusCircular,
    flexShrink: 0,
  },
  userIcon: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  assistantIcon: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
  },
  messageContent: {
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
  },
  userContent: {
    backgroundColor: tokens.colorBrandBackground2,
  },
  assistantContent: {
    backgroundColor: tokens.colorNeutralBackground2,
  },
  toolsUsed: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
    marginTop: tokens.spacingVerticalS,
  },
  inputArea: {
    padding: tokens.spacingVerticalL,
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  inputField: {
    flex: 1,
  },
  emptyState: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXXXL,
    color: tokens.colorNeutralForeground3,
  },
  errorCard: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    padding: tokens.spacingVerticalM,
  },
})

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AgentChat() {
  const styles = useStyles()
  const messagesEndRef = useRef(null)

  // State
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ============================================================================
  // ACTIONS - Side effects
  // ============================================================================

  async function handleSendMessage() {
    if (!inputText.trim() || isLoading) return

    const userMessage = {
      role: 'user',
      content: inputText.trim(),
    }

    // Add user message to chat
    setMessages(prev => [...prev, userMessage])
    setInputText('')
    setIsLoading(true)
    setError(null)

    try {
      // Call Agent API
      const response = await agentChat(userMessage.content)
      
      // Add assistant response to chat with tools used
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.result,
        toolsUsed: response.tools_used || [],
      }])
    } catch (err) {
      console.error('Agent error:', err)
      setError(err.message || 'Failed to get response from agent')
    } finally {
      setIsLoading(false)
    }
  }

  function handleClearChat() {
    setMessages([])
    setError(null)
  }

  function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <CardHeader
          header={
            <div className={styles.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
                <Bot24Regular />
                <Text weight="semibold" size={500}>
                  AI Agent
                </Text>
                <Badge color="informative" appearance="filled">Azure OpenAI</Badge>
              </div>
              <div className={styles.headerControls}>
                <Text size={200}>Powered by LangGraph + GPT</Text>
                <Button
                  icon={<Delete24Regular />}
                  appearance="subtle"
                  onClick={handleClearChat}
                  disabled={messages.length === 0}
                >
                  Clear
                </Button>
              </div>
            </div>
          }
        />

        {/* Messages Area */}
        <div className={styles.messagesContainer}>
          {messages.length === 0 && !error && (
            <div className={styles.emptyState}>
              <Bot24Regular style={{ fontSize: '48px', marginBottom: tokens.spacingVerticalM }} />
              <Text size={400}>Start a conversation with the AI Agent</Text>
              <Text size={300} style={{ marginTop: tokens.spacingVerticalS, display: 'block' }}>
                The agent can manage tasks and tickets for you!
              </Text>
              <Text size={200} style={{ marginTop: tokens.spacingVerticalM, display: 'block' }}>
                Try: "Create a task to review the documentation" or "List all tasks"
              </Text>
            </div>
          )}

          {error && (
            <Card appearance="filled" className={styles.errorCard}>
              <Text weight="semibold">⚠️ {error}</Text>
            </Card>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`${styles.message} ${
                message.role === 'user' ? styles.userMessage : styles.assistantMessage
              }`}
            >
              <div
                className={`${styles.messageIcon} ${
                  message.role === 'user' ? styles.userIcon : styles.assistantIcon
                }`}
              >
                {message.role === 'user' ? <Person24Regular /> : <Bot24Regular />}
              </div>
              <div
                className={`${styles.messageContent} ${
                  message.role === 'user' ? styles.userContent : styles.assistantContent
                }`}
              >
                <Text>{message.content}</Text>
                {message.toolsUsed && message.toolsUsed.length > 0 && (
                  <div className={styles.toolsUsed}>
                    <Wrench20Regular style={{ marginRight: tokens.spacingHorizontalXS }} />
                    {message.toolsUsed.map((tool, i) => (
                      <Tag key={i} size="small" appearance="outline">{tool}</Tag>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className={`${styles.message} ${styles.assistantMessage}`}>
              <div className={`${styles.messageIcon} ${styles.assistantIcon}`}>
                <Bot24Regular />
              </div>
              <div className={`${styles.messageContent} ${styles.assistantContent}`}>
                <Spinner size="tiny" label="Thinking..." />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className={styles.inputArea}>
          <Field className={styles.inputField}>
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask the agent to manage tasks or tickets... (Shift+Enter for new line)"
              resize="vertical"
              rows={2}
              data-testid="agent-input"
            />
          </Field>
          <Button
            appearance="primary"
            icon={<Send24Regular />}
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isLoading}
            data-testid="agent-send"
          >
            Send
          </Button>
        </div>
      </Card>
    </div>
  )
}
