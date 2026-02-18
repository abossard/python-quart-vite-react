import {
    Badge,
    Button,
    Card,
    CardHeader,
    Field,
    Spinner,
    Subtitle1,
    Text,
    Textarea,
    makeStyles,
    tokens,
} from '@fluentui/react-components'
import {
    ArrowSync24Regular,
    Bot24Regular,
    Play24Regular,
} from '@fluentui/react-icons'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    createUsecaseDemoAgentRun,
    getCSVTicket,
    getUsecaseDemoAgentRun,
    listUsecaseDemoAgentRuns,
} from '../../services/api'
import { RESULT_VIEW_REGISTRY } from './resultViews'
import {
    extractTicketIdsFromRows,
    formatDateTime,
    sanitizeMarkdownForDisplay,
    upsertRun,
} from './usecaseDemoUtils'

const STATUS_COLORS = {
  queued: 'informative',
  running: 'warning',
  completed: 'success',
  failed: 'danger',
}

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
    display: 'grid',
    gap: tokens.spacingVerticalL,
  },
  section: {
    display: 'grid',
    gap: tokens.spacingVerticalM,
  },
  promptActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  runMeta: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: tokens.spacingVerticalS,
  },
  tableWrapper: {
    overflowX: 'auto',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground3,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    verticalAlign: 'top',
  },
  rowAlt: {
    backgroundColor: tokens.colorNeutralBackground2,
  },
  markdown: {
    '& h1, & h2, & h3': {
      margin: `${tokens.spacingVerticalS} 0 ${tokens.spacingVerticalXS}`,
      fontWeight: tokens.fontWeightSemibold,
    },
    '& ul, & ol': {
      paddingLeft: tokens.spacingHorizontalL,
      margin: `${tokens.spacingVerticalXS} 0`,
    },
    '& table': {
      width: '100%',
      borderCollapse: 'collapse',
    },
    '& th, & td': {
      border: `1px solid ${tokens.colorNeutralStroke1}`,
      padding: tokens.spacingHorizontalXS,
      textAlign: 'left',
    },
    '& pre': {
      backgroundColor: tokens.colorNeutralBackground3,
      padding: tokens.spacingHorizontalM,
      borderRadius: tokens.borderRadiusSmall,
      overflowX: 'auto',
    },
  },
  historyTable: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  ticketDetails: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingHorizontalM,
    display: 'grid',
    gap: tokens.spacingVerticalXS,
  },
  viewSection: {
    display: 'grid',
    gap: tokens.spacingVerticalXS,
  },
  viewDescription: {
    color: tokens.colorNeutralForeground3,
  },
})

function statusBadge(status) {
  return (
    <Badge appearance="filled" color={STATUS_COLORS[status] || 'subtle'}>
      {status || 'unknown'}
    </Badge>
  )
}

export default function UsecaseDemoPage({ definition }) {
  const styles = useStyles()
  const testIdPrefix = definition.testIdPrefix || 'usecase-demo'

  const [prompt, setPrompt] = useState(definition.defaultPrompt)
  const [currentRun, setCurrentRun] = useState(null)
  const [runs, setRuns] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [matchingTickets, setMatchingTickets] = useState([])
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [isLoadingTickets, setIsLoadingTickets] = useState(false)
  const [ticketLoadError, setTicketLoadError] = useState(null)

  useEffect(() => {
    setPrompt(definition.defaultPrompt)
    setCurrentRun(null)
    setRuns([])
    setError(null)
    setMatchingTickets([])
    setSelectedTicketId(null)
    setIsLoadingTickets(false)
    setTicketLoadError(null)
  }, [definition.id, definition.defaultPrompt])

  const loadRuns = useCallback(async () => {
    try {
      const data = await listUsecaseDemoAgentRuns(definition.runHistoryLimit || 25)
      setRuns(data.runs || [])
    } catch (err) {
      setError(err.message || 'Failed to load run history')
    }
  }, [definition.runHistoryLimit])

  useEffect(() => {
    loadRuns()
  }, [loadRuns])

  useEffect(() => {
    if (!currentRun?.id || !['queued', 'running'].includes(currentRun.status)) {
      return undefined
    }

    const runId = currentRun.id
    const interval = setInterval(async () => {
      try {
        const updated = await getUsecaseDemoAgentRun(runId)
        setCurrentRun(updated)
        setRuns((prev) => upsertRun(prev, updated, definition.runHistoryLimit || 25))
      } catch (err) {
        setError(err.message || 'Failed to poll run status')
      }
    }, definition.pollIntervalMs || 2000)

    return () => clearInterval(interval)
  }, [
    currentRun?.id,
    currentRun?.status,
    definition.pollIntervalMs,
    definition.runHistoryLimit,
  ])

  const matchingTicketIds = useMemo(
    () => extractTicketIdsFromRows(currentRun?.result_rows || [], definition.ticketIdFields),
    [currentRun?.result_rows, definition.ticketIdFields]
  )

  const selectedTicket = useMemo(
    () => matchingTickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [matchingTickets, selectedTicketId]
  )

  const visibleResultMarkdown = useMemo(
    () => sanitizeMarkdownForDisplay(currentRun?.result_markdown || ''),
    [currentRun?.result_markdown]
  )

  const enabledResultViews = useMemo(() => {
    const configuredViews = definition.resultViews?.length ? definition.resultViews : ['table', 'markdown']
    return configuredViews
      .map((viewKey) => ({ key: viewKey, config: RESULT_VIEW_REGISTRY[viewKey] }))
      .filter((item) => Boolean(item.config))
  }, [definition.resultViews])

  useEffect(() => {
    if (!definition.matchingTickets?.enabled) {
      return
    }

    let isCancelled = false

    async function loadMatchingTickets() {
      if (!matchingTicketIds.length) {
        setMatchingTickets([])
        setSelectedTicketId(null)
        setTicketLoadError(null)
        return
      }

      setIsLoadingTickets(true)
      setTicketLoadError(null)

      const fields = definition.matchingTickets.fields || []
      const tickets = await Promise.all(
        matchingTicketIds.map(async (ticketId) => {
          try {
            return await getCSVTicket(ticketId, fields)
          } catch (ticketError) {
            return { id: ticketId, _error: ticketError.message || 'Failed to load ticket' }
          }
        })
      )

      if (isCancelled) return

      const loadedTickets = tickets.filter((ticket) => !ticket._error)
      setMatchingTickets(loadedTickets)
      setSelectedTicketId((previousId) => {
        if (previousId && loadedTickets.some((ticket) => ticket.id === previousId)) {
          return previousId
        }
        return loadedTickets[0]?.id || null
      })

      if (!loadedTickets.length) {
        setTicketLoadError('No matching tickets could be loaded from CSV data.')
      }

      setIsLoadingTickets(false)
    }

    loadMatchingTickets().catch((ticketError) => {
      if (isCancelled) return
      setMatchingTickets([])
      setSelectedTicketId(null)
      setTicketLoadError(ticketError.message || 'Failed to load matching tickets')
      setIsLoadingTickets(false)
    })

    return () => {
      isCancelled = true
    }
  }, [definition.matchingTickets, matchingTicketIds])

  async function handleStartRun() {
    if (!prompt.trim()) return
    setError(null)
    setIsSubmitting(true)

    try {
      const createdRun = await createUsecaseDemoAgentRun(prompt)
      setCurrentRun(createdRun)
      setRuns((prev) => upsertRun(prev, createdRun, definition.runHistoryLimit || 25))
    } catch (err) {
      setError(err.message || 'Failed to start background run')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSelectRun(runId) {
    setError(null)
    try {
      const selected = await getUsecaseDemoAgentRun(runId)
      setCurrentRun(selected)
      setRuns((prev) => upsertRun(prev, selected, definition.runHistoryLimit || 25))
    } catch (err) {
      setError(err.message || 'Failed to load run details')
    }
  }

  return (
    <div className={styles.container}>
      <Card className={styles.section}>
        <CardHeader
          header={
            <div style={{ display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'center' }}>
              <Subtitle1>{definition.title}</Subtitle1>
              {definition.menuPointBadge && (
                <Badge color="brand" appearance="filled">{definition.menuPointBadge}</Badge>
              )}
            </div>
          }
          description={definition.pageDescription}
        />
      </Card>

      <Card className={styles.section}>
        <CardHeader
          header={<Text weight="semibold">{definition.promptLabel || 'Agent Prompt'}</Text>}
          description={definition.promptDescription || 'Edit the prompt, then start the agent run in the background.'}
        />

        <Field>
          <Textarea
            value={prompt}
            onChange={(_, data) => setPrompt(data.value)}
            rows={8}
            resize="vertical"
            placeholder="Describe what the agent should analyze and output..."
            data-testid={`${testIdPrefix}-prompt`}
          />
        </Field>

        <div className={styles.promptActions}>
          <Button
            appearance="primary"
            icon={<Play24Regular />}
            onClick={handleStartRun}
            disabled={!prompt.trim() || isSubmitting}
            data-testid={`${testIdPrefix}-start-agent`}
          >
            Start Agent In Background
          </Button>
          <Button
            appearance="subtle"
            icon={<ArrowSync24Regular />}
            onClick={loadRuns}
            disabled={isSubmitting}
          >
            Refresh Runs
          </Button>
          {isSubmitting && <Spinner size="tiny" label="Queueing run..." />}
        </div>
      </Card>

      <Card className={styles.section}>
        <CardHeader
          header={<Text weight="semibold">Current Run</Text>}
          description={currentRun ? `Run ID: ${currentRun.id}` : 'Start a run to see status and output.'}
        />

        {!currentRun ? (
          <Text>No run selected yet.</Text>
        ) : (
          <>
            <div className={styles.runMeta}>
              <div>
                <Text size={200}>Status</Text>
                <div>{statusBadge(currentRun.status)}</div>
              </div>
              <div>
                <Text size={200}>Created</Text>
                <div><Text>{formatDateTime(currentRun.created_at)}</Text></div>
              </div>
              <div>
                <Text size={200}>Started</Text>
                <div><Text>{formatDateTime(currentRun.started_at)}</Text></div>
              </div>
              <div>
                <Text size={200}>Completed</Text>
                <div><Text>{formatDateTime(currentRun.completed_at)}</Text></div>
              </div>
            </div>

            {['queued', 'running'].includes(currentRun.status) && (
              <Spinner size="small" label="Agent is running in the background..." />
            )}

            {currentRun.error && (
              <Text style={{ color: tokens.colorPaletteRedForeground1 }}>
                {currentRun.error}
              </Text>
            )}
          </>
        )}
      </Card>

      <Card className={styles.section}>
        <CardHeader
          header={
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
              <Bot24Regular />
              <Text weight="semibold">{definition.resultSectionTitle || 'Agent Results'}</Text>
            </div>
          }
          description={
            definition.resultSectionDescription ||
            'Configured result views are rendered below.'
          }
        />

        {!currentRun ? (
          <Text>No result available yet.</Text>
        ) : (
          enabledResultViews.map(({ key, config }) => (
            <div key={key} className={styles.viewSection} data-testid={`${testIdPrefix}-result-view-${key}`}>
              <Text weight="semibold">{config.title}</Text>
              {config.description && (
                <Text size={200} className={styles.viewDescription}>{config.description}</Text>
              )}
              {config.render({ run: currentRun, markdown: visibleResultMarkdown, styles, matchingTickets, isLoadingTickets })}
            </div>
          ))
        )}
      </Card>

      {definition.matchingTickets?.enabled && (
        <Card className={styles.section}>
          <CardHeader
            header={<Text weight="semibold">{definition.matchingTickets.title || 'Matching Tickets'}</Text>}
            description={
              definition.matchingTickets.description ||
              'Ticket IDs from the agent result are resolved against CSV data. Click a ticket to inspect details.'
            }
          />

          {!currentRun ? (
            <Text>Start a run to load matching tickets.</Text>
          ) : isLoadingTickets ? (
            <Spinner size="small" label="Loading matching tickets..." />
          ) : matchingTickets.length === 0 ? (
            <Text>{ticketLoadError || 'No ticket IDs found in the current run result.'}</Text>
          ) : (
            <>
              <div className={styles.tableWrapper}>
                <table className={styles.historyTable} data-testid={`${testIdPrefix}-matching-tickets`}>
                  <thead>
                    <tr>
                      <th className={styles.th}>Ticket ID</th>
                      <th className={styles.th}>Summary</th>
                      <th className={styles.th}>Status</th>
                      <th className={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchingTickets.map((ticket, index) => (
                      <tr key={ticket.id} className={index % 2 ? styles.rowAlt : ''}>
                        <td className={styles.td}>{ticket.id}</td>
                        <td className={styles.td}>{ticket.summary || '—'}</td>
                        <td className={styles.td}>{ticket.status || '—'}</td>
                        <td className={styles.td}>
                          <Button
                            size="small"
                            appearance={selectedTicketId === ticket.id ? 'primary' : 'secondary'}
                            onClick={() => setSelectedTicketId(ticket.id)}
                            data-testid={`${testIdPrefix}-ticket-open-${ticket.id}`}
                          >
                            Open
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedTicket && (
                <div className={styles.ticketDetails} data-testid={`${testIdPrefix}-ticket-details`}>
                  <Text weight="semibold">{selectedTicket.summary || 'Ticket Details'}</Text>
                  <Text>ID: {selectedTicket.id}</Text>
                  <Text>Status: {selectedTicket.status || '—'}</Text>
                  <Text>Priority: {selectedTicket.priority || '—'}</Text>
                  <Text>Assignee: {selectedTicket.assignee || '—'}</Text>
                  <Text>Assigned Group: {selectedTicket.assigned_group || '—'}</Text>
                  <Text>Requester: {selectedTicket.requester_name || '—'}</Text>
                  <Text>City: {selectedTicket.city || '—'}</Text>
                  <Text>Service: {selectedTicket.service || '—'}</Text>
                  <Text>Description: {selectedTicket.description || '—'}</Text>
                  <Text>Notes: {selectedTicket.notes || '—'}</Text>
                  <Text>Resolution: {selectedTicket.resolution || '—'}</Text>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      <Card className={styles.section}>
        <CardHeader
          header={<Text weight="semibold">Run History</Text>}
          description="Open a previous run to inspect details and output."
        />

        {runs.length === 0 ? (
          <Text>No runs yet.</Text>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.historyTable}>
              <thead>
                <tr>
                  <th className={styles.th}>Created</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}>Rows</th>
                  <th className={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, index) => (
                  <tr key={run.id} className={index % 2 ? styles.rowAlt : ''}>
                    <td className={styles.td}>{formatDateTime(run.created_at)}</td>
                    <td className={styles.td}>{statusBadge(run.status)}</td>
                    <td className={styles.td}>{run.result_rows?.length || 0}</td>
                    <td className={styles.td}>
                      <Button
                        size="small"
                        appearance={currentRun?.id === run.id ? 'primary' : 'secondary'}
                        onClick={() => handleSelectRun(run.id)}
                      >
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {error && (
        <Card>
          <Text style={{ color: tokens.colorPaletteRedForeground1 }}>{error}</Text>
        </Card>
      )}
    </div>
  )
}
