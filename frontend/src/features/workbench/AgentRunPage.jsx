/**
 * AgentRunPage — Standalone page for running a specific agent.
 *
 * Shown as a tab when an agent has show_in_menu=true.
 * Minimal UI: description, optional input field, run button, output.
 */

import {
  Button,
  Card,
  Field,
  Spinner,
  Subtitle1,
  Text,
  Textarea,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { useEffect, useState } from 'react'
import { runWorkbenchAgent } from '../../services/api'
import SchemaRenderer from './SchemaRenderer'

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    maxWidth: '800px',
  },
  outputContainer: {
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground1,
    maxHeight: '500px',
    overflowY: 'auto',
  },
})

export default function AgentRunPage({ agent }) {
  const styles = useStyles()
  const [prompt, setPrompt] = useState('')
  const [requiredInput, setRequiredInput] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [output, setOutput] = useState(null)

  if (!agent) {
    return <Spinner label="Loading agent..." />
  }

  const parsedOutput = (() => {
    if (!output) return null
    try {
      const parsed = JSON.parse(output)
      if (typeof parsed === 'object' && parsed !== null) return parsed
    } catch { /* not JSON */ }
    return { message: output }
  })()

  const handleRun = async () => {
    setError('')
    setOutput(null)

    if (agent.requires_input && !requiredInput.trim()) {
      setError(`Required: ${agent.required_input_description || 'input value'}`)
      return
    }

    setRunning(true)
    try {
      const run = await runWorkbenchAgent(agent.id, {
        inputPrompt: prompt.trim(),
        requiredInputValue: requiredInput.trim(),
      })
      setOutput(run?.output || '(no output)')
    } catch (err) {
      setError(err?.message || 'Agent run failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className={styles.container}>
      <div>
        <Subtitle1 data-testid="agent-run-page-title">{agent.name}</Subtitle1>
        {agent.description && <Text>{agent.description}</Text>}
      </div>

      <Card>
        {agent.requires_input && (
          <Field label={agent.required_input_description || 'Required input'} required>
            <Textarea
              data-testid="agent-run-required-input"
              value={requiredInput}
              onChange={(_, d) => setRequiredInput(d.value)}
              rows={1}
              placeholder={agent.required_input_description}
            />
          </Field>
        )}
        <Field label="Prompt (optional)">
          <Textarea
            data-testid="agent-run-prompt"
            value={prompt}
            onChange={(_, d) => setPrompt(d.value)}
            rows={2}
            placeholder="Additional instructions..."
          />
        </Field>
        <Button
          appearance="primary"
          data-testid="agent-run-button"
          onClick={handleRun}
          disabled={running}
          style={{ marginTop: tokens.spacingVerticalS }}
        >
          {running ? 'Running...' : 'Run'}
        </Button>
        {error && <Text style={{ color: tokens.colorPaletteRedForeground1 }}>{error}</Text>}
      </Card>

      {parsedOutput && (
        <div data-testid="agent-run-output" className={styles.outputContainer}>
          <SchemaRenderer
            data={parsedOutput}
            schema={agent.output_schema?.properties ? agent.output_schema : undefined}
          />
        </div>
      )}
    </div>
  )
}
