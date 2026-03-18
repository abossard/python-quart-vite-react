import {
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  Bot24Regular,
  Delete24Regular,
  Edit24Regular,
  Play24Regular,
} from '@fluentui/react-icons'
import { useState } from 'react'
import { runWorkbenchAgent } from '../../services/api'

const useStyles = makeStyles({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: tokens.spacingHorizontalL,
    '@media (max-width: 1200px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr',
    },
  },
  card: {
    padding: tokens.spacingVerticalM,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  description: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    marginTop: 'auto',
  },
  inputRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    alignItems: 'center',
  },
  runButton: {
    flexShrink: 0,
  },
})

export default function AgentCardsPanel({
  agents,
  onEdit,
  onDelete,
  onRunStarted,
  onRefresh,
}) {
  const styles = useStyles()
  const [runningIds, setRunningIds] = useState({})
  const [inputVisibleIds, setInputVisibleIds] = useState({})
  const [inputValues, setInputValues] = useState({})

  async function handleRun(agent) {
    if (agent.requires_input && !inputVisibleIds[agent.id]) {
      setInputVisibleIds((prev) => ({ ...prev, [agent.id]: true }))
      return
    }

    setRunningIds((prev) => ({ ...prev, [agent.id]: true }))
    try {
      const run = await runWorkbenchAgent(agent.id, {
        requiredInputValue: inputValues[agent.id] || '',
      })
      onRunStarted?.(run)
    } catch (err) {
      console.error(`Failed to run agent ${agent.id}:`, err)
    } finally {
      setRunningIds((prev) => ({ ...prev, [agent.id]: false }))
      setInputVisibleIds((prev) => ({ ...prev, [agent.id]: false }))
      setInputValues((prev) => ({ ...prev, [agent.id]: '' }))
    }
  }

  if (!agents || agents.length === 0) {
    return <Text italic>No agents configured. Create one to get started.</Text>
  }

  return (
    <div className={styles.grid}>
      {agents.map((agent) => (
        <Card
          key={agent.id}
          className={styles.card}
          data-testid={`agent-card-${agent.id}`}
        >
          <CardHeader
            image={<Bot24Regular />}
            header={<Text weight="semibold">{agent.name}</Text>}
            action={
              runningIds[agent.id] ? (
                <Spinner size="tiny" />
              ) : null
            }
          />

          {agent.description && (
            <Text className={styles.description}>{agent.description}</Text>
          )}

          <div className={styles.meta}>
            {agent.tool_names?.length > 0 && (
              <Badge appearance="outline" size="small">
                {agent.tool_names.length} tools
              </Badge>
            )}
            {agent.show_in_menu && (
              <Badge appearance="tint" color="brand" size="small">
                Menu
              </Badge>
            )}
          </div>

          {inputVisibleIds[agent.id] && (
            <div className={styles.inputRow}>
              <Input
                size="small"
                placeholder={agent.required_input_description || 'Enter input…'}
                value={inputValues[agent.id] || ''}
                onChange={(_, data) =>
                  setInputValues((prev) => ({ ...prev, [agent.id]: data.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRun(agent)
                }}
              />
              <Button
                size="small"
                appearance="primary"
                onClick={() => handleRun(agent)}
                disabled={runningIds[agent.id]}
              >
                Go
              </Button>
            </div>
          )}

          <div className={styles.actions}>
            <Button
              className={styles.runButton}
              appearance="primary"
              size="small"
              icon={<Play24Regular />}
              onClick={() => handleRun(agent)}
              disabled={runningIds[agent.id]}
              data-testid={`agent-card-run-${agent.id}`}
            >
              Run
            </Button>
            <Button
              appearance="subtle"
              size="small"
              icon={<Edit24Regular />}
              onClick={() => onEdit?.(agent)}
              data-testid={`agent-card-edit-${agent.id}`}
            />
            <Button
              appearance="subtle"
              size="small"
              icon={<Delete24Regular />}
              onClick={() => onDelete?.(agent.id)}
              data-testid={`agent-card-delete-${agent.id}`}
            />
          </div>
        </Card>
      ))}
    </div>
  )
}
