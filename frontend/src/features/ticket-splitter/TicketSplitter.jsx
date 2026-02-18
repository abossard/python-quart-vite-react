/**
 * Ticket Splitter Component
 * 
 * Analyzes CSV tickets to identify those with multiple issues
 * and provides AI-generated split suggestions.
 * 
 * Workflow:
 * 1. User clicks "Analyze Tickets" with limit input
 * 2. Displays two-column view: normal vs multi-issue tickets
 * 3. User selects multi-issue ticket to see split suggestions
 */

import { useState } from 'react'
import {
  makeStyles,
  Button,
  Card,
  CardHeader,
  Spinner,
  Text,
  Badge,
  Input,
  Label,
  DataGrid,
  DataGridHeader,
  DataGridRow,
  DataGridHeaderCell,
  DataGridBody,
  DataGridCell,
  tokens,
  Title3,
  Body1,
  Divider,
} from '@fluentui/react-components'
import {
  PlayRegular,
  SplitVerticalRegular,
  CheckmarkCircleRegular,
  WarningRegular,
} from '@fluentui/react-icons'
import { analyzeTicketsForSplitting } from '../../services/api'

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalXXL,
  },
  header: {
    marginBottom: tokens.spacingVerticalXL,
  },
  startSection: {
    marginBottom: tokens.spacingVerticalXL,
  },
  inputGroup: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'flex-end',
    marginTop: tokens.spacingVerticalM,
  },
  twoColumns: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingHorizontalXL,
    marginTop: tokens.spacingVerticalXL,
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  columnHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalS,
  },
  ticketCard: {
    cursor: 'pointer',
    transition: 'all 0.2s',
    '&:hover': {
      boxShadow: tokens.shadow8,
    },
  },
  selectedCard: {
    borderColor: tokens.colorBrandBackground,
    borderWidth: '2px',
  },
  detailPanel: {
    marginTop: tokens.spacingVerticalXL,
  },
  issuesList: {
    marginTop: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
  },
  splitSuggestions: {
    marginTop: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  splitCard: {
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalXXL,
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
    marginTop: tokens.spacingVerticalM,
  },
})

export default function TicketSplitter() {
  const styles = useStyles()
  const [limit, setLimit] = useState(50)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [selectedTicket, setSelectedTicket] = useState(null)

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)
    setSelectedTicket(null)

    try {
      const result = await analyzeTicketsForSplitting(limit)
      setAnalysisResult(result)
    } catch (err) {
      setError(err.message || 'Analyse fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  const renderStartSection = () => (
    <Card className={styles.startSection}>
      <CardHeader
        header={
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
            <SplitVerticalRegular fontSize={24} />
            <Title3>Ticket-Splitting Analyse</Title3>
          </div>
        }
        description="Identifiziert Tickets mit mehreren Problemen und schlägt Aufteilungen vor"
      />
      <div style={{ padding: tokens.spacingVerticalM }}>
        <div className={styles.inputGroup}>
          <div>
            <Label htmlFor="limit-input">Anzahl Tickets zu analysieren</Label>
            <Input
              id="limit-input"
              type="number"
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(200, parseInt(e.target.value) || 50)))}
              min={1}
              max={200}
              disabled={loading}
            />
          </div>
          <Button
            appearance="primary"
            icon={<PlayRegular />}
            onClick={handleAnalyze}
            disabled={loading}
          >
            {loading ? 'Analysiere...' : 'Tickets analysieren'}
          </Button>
        </div>
        {error && (
          <Text className={styles.error}>{error}</Text>
        )}
      </div>
    </Card>
  )

  const renderLoading = () => (
    <div className={styles.loading}>
      <Spinner size="huge" label="Analysiere Tickets mit GPT..." />
      <Text>Dies kann 30-60 Sekunden dauern...</Text>
    </div>
  )

  const renderResults = () => {
    if (!analysisResult) return null

    const { analyzed_count, single_issue_tickets = [], multi_issue_tickets = [] } = analysisResult

    return (
      <>
        <Card>
          <CardHeader
            header={<Title3>Analyse-Ergebnisse</Title3>}
            description={`${analyzed_count} Tickets analysiert`}
          />
          <div style={{ padding: tokens.spacingVerticalM }}>
            <div style={{ display: 'flex', gap: tokens.spacingHorizontalL }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
                <CheckmarkCircleRegular fontSize={20} color={tokens.colorPaletteGreenForeground1} />
                <Text weight="semibold">{single_issue_tickets.length} Einzelproblem-Tickets</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
                <WarningRegular fontSize={20} color={tokens.colorPaletteYellowForeground1} />
                <Text weight="semibold">{multi_issue_tickets.length} Multi-Problem-Tickets</Text>
              </div>
            </div>
          </div>
        </Card>

        <div className={styles.twoColumns}>
          {/* Left Column: Single Issue Tickets */}
          <div className={styles.column}>
            <div className={styles.columnHeader}>
              <CheckmarkCircleRegular fontSize={20} color={tokens.colorPaletteGreenForeground1} />
              <Text weight="semibold" size={400}>Einzelproblem-Tickets</Text>
              <Badge appearance="filled" color="success">{single_issue_tickets.length}</Badge>
            </div>
            {single_issue_tickets.length === 0 ? (
              <Text>Keine Einzelproblem-Tickets gefunden</Text>
            ) : (
              single_issue_tickets.map((ticket) => (
                <Card key={ticket.id} className={styles.ticketCard}>
                  <div style={{ padding: tokens.spacingVerticalS }}>
                    <Text weight="semibold" block>{ticket.summary}</Text>
                    {ticket.reason && (
                      <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                        {ticket.reason}
                      </Text>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Right Column: Multi Issue Tickets */}
          <div className={styles.column}>
            <div className={styles.columnHeader}>
              <WarningRegular fontSize={20} color={tokens.colorPaletteYellowForeground1} />
              <Text weight="semibold" size={400}>Multi-Problem-Tickets</Text>
              <Badge appearance="filled" color="warning">{multi_issue_tickets.length}</Badge>
            </div>
            {multi_issue_tickets.length === 0 ? (
              <Text>Keine Multi-Problem-Tickets gefunden</Text>
            ) : (
              multi_issue_tickets.map((ticket) => (
                <Card
                  key={ticket.id}
                  className={`${styles.ticketCard} ${selectedTicket?.id === ticket.id ? styles.selectedCard : ''}`}
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <div style={{ padding: tokens.spacingVerticalS }}>
                    <Text weight="semibold" block>{ticket.summary}</Text>
                    {ticket.issues_identified && (
                      <Badge appearance="tint" color="warning" style={{ marginTop: tokens.spacingVerticalXS }}>
                        {ticket.issues_identified.length} Probleme erkannt
                      </Badge>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {renderDetailPanel()}
      </>
    )
  }

  const renderDetailPanel = () => {
    if (!selectedTicket) return null

    const { summary, issues_identified = [], suggested_splits = [] } = selectedTicket

    return (
      <Card className={styles.detailPanel}>
        <CardHeader
          header={<Title3>Split-Vorschläge</Title3>}
          description={summary}
        />
        <div style={{ padding: tokens.spacingVerticalM }}>
          <Body1 weight="semibold">Erkannte Probleme:</Body1>
          <ul className={styles.issuesList}>
            {issues_identified.map((issue, idx) => (
              <li key={idx}>
                <Text>{issue}</Text>
              </li>
            ))}
          </ul>

          <Divider style={{ margin: `${tokens.spacingVerticalL} 0` }} />

          <Body1 weight="semibold">Vorgeschlagene Aufteilung:</Body1>
          <div className={styles.splitSuggestions}>
            {suggested_splits.map((split, idx) => (
              <Card key={idx} className={styles.splitCard}>
                <Text weight="semibold" block style={{ marginBottom: tokens.spacingVerticalXS }}>
                  {split.title}
                </Text>
                <Text block style={{ marginBottom: tokens.spacingVerticalXS }}>
                  {split.description}
                </Text>
                <Badge appearance="outline">Priorität: {split.priority}</Badge>
              </Card>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title3>Ticket Splitter</Title3>
        <Text>Analysiert Tickets mit mehreren Problemen und schlägt Aufteilungen vor</Text>
      </div>

      {renderStartSection()}

      {loading && renderLoading()}

      {!loading && analysisResult && renderResults()}
    </div>
  )
}
