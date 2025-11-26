/**
 * OllamaChat Component
 *
 * Chat interface for local LLM powered by Ollama
 * Demonstrates FluentUI messaging components and state management
 *
 * Following principles:
 * - Pure functions for message formatting (calculations)
 * - Side effects isolated in event handlers (actions)
 * - Clear separation of concerns
 */

import { useState, useEffect, useRef } from 'react'
import {
  Card,
  CardHeader,
  Text,
  Button,
  Textarea,
  makeStyles,
  tokens,
  Spinner,
  Badge,
  Field,
  Dropdown,
  Option,
} from '@fluentui/react-components'
import {
  Send24Regular,
  Bot24Regular,
  Person24Regular,
  Delete24Regular,
} from '@fluentui/react-icons'
import { ollamaChat, listOllamaModels } from '../../services/api'

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
  modelSelector: {
    minWidth: '200px',
  },
  statusBadge: {
    marginLeft: tokens.spacingHorizontalS,
  },
})

// ============================================================================
// CALCULATIONS - Pure functions
// ============================================================================

function formatMessageForDisplay(message) {
  return {
    role: message.role,
    content: message.content,
    timestamp: new Date().toLocaleTimeString(),
  }
}

function buildChatRequest(messages, model, temperature = 0.7) {
  return {
    messages: messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
    model,
    temperature,
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function OllamaChat() {
  const styles = useStyles()
  const messagesEndRef = useRef(null)

  // State
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState('llama3.2:1b')
  const [isOllamaAvailable, setIsOllamaAvailable] = useState(true)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load available models on mount
  useEffect(() => {
    loadModels()
  }, [])

  // ============================================================================
  // ACTIONS - Side effects
  // ============================================================================

  async function loadModels() {
    try {
      const response = await listOllamaModels()
      setModels(response.models || [])
      setIsOllamaAvailable(true)
      setError(null)
      
      // Set default model if available
      if (response.models && response.models.length > 0) {
        const defaultModel = response.models.find(m => m.name.includes('llama3.2:1b'))
        if (defaultModel) {
          setSelectedModel(defaultModel.name)
        } else {
          setSelectedModel(response.models[0].name)
        }
      }
    } catch (err) {
      console.error('Failed to load models:', err)
      setIsOllamaAvailable(false)
      setError('Ollama not available. Make sure it\'s running: ollama serve')
    }
  }

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
      // Build request with conversation history
      const request = buildChatRequest([...messages, userMessage], selectedModel)
      
      // Call Ollama API
      const response = await ollamaChat(request)
      
      // Add assistant response to chat
      setMessages(prev => [...prev, response.message])
      setIsOllamaAvailable(true)
    } catch (err) {
      console.error('Chat error:', err)
      setError(err.message || 'Failed to get response from Ollama')
      setIsOllamaAvailable(false)
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
                  Ollama Chat
                </Text>
                {isOllamaAvailable ? (
                  <Badge color="success" appearance="filled">Connected</Badge>
                ) : (
                  <Badge color="danger" appearance="filled">Offline</Badge>
                )}
              </div>
              <div className={styles.headerControls}>
                <Field label="Model" className={styles.modelSelector}>
                  <Dropdown
                    value={selectedModel}
                    onOptionSelect={(_, data) => setSelectedModel(data.optionValue)}
                    disabled={models.length === 0}
                  >
                    {models.map(model => (
                      <Option key={model.name} value={model.name}>
                        {model.name}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
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
              <Text size={400}>Start a conversation with Ollama</Text>
              <Text size={300} style={{ marginTop: tokens.spacingVerticalS }}>
                Ask questions, get help with code, or just chat!
              </Text>
            </div>
          )}

          {error && !isOllamaAvailable && (
            <Card
              appearance="filled"
              style={{
                backgroundColor: tokens.colorPaletteRedBackground1,
                padding: tokens.spacingVerticalM,
              }}
            >
              <Text weight="semibold">⚠️ Ollama Not Available</Text>
              <Text size={300} style={{ display: 'block', marginTop: tokens.spacingVerticalS }}>
                {error}
              </Text>
              <Text size={300} style={{ display: 'block', marginTop: tokens.spacingVerticalS }}>
                Install: <code>curl -fsSL https://ollama.com/install.sh | sh</code>
              </Text>
              <Text size={300} style={{ display: 'block' }}>
                Start: <code>ollama serve</code>
              </Text>
              <Text size={300} style={{ display: 'block' }}>
                Pull model: <code>ollama pull llama3.2:1b</code>
              </Text>
              <Button
                appearance="primary"
                onClick={loadModels}
                style={{ marginTop: tokens.spacingVerticalM }}
              >
                Retry Connection
              </Button>
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
              placeholder="Type your message... (Shift+Enter for new line)"
              resize="vertical"
              rows={2}
              disabled={!isOllamaAvailable}
              data-testid="ollama-input"
            />
          </Field>
          <Button
            appearance="primary"
            icon={<Send24Regular />}
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isLoading || !isOllamaAvailable}
            data-testid="ollama-send"
          >
            Send
          </Button>
        </div>
      </Card>
    </div>
  )
}
