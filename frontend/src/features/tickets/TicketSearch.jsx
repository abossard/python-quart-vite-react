/**
 * TicketSearch Component
 *
 * Search for support tickets by ticket number
 * Displays ticket details: assignee, summary, description, resolution
 *
 * Following principles:
 * - Pure functions for data transformations (calculations)
 * - Side effects isolated in event handlers (actions)
 * - Clear component interface
 */

import { useState } from 'react'
import {
  Card,
  CardHeader,
  Text,
  Button,
  Input,
  makeStyles,
  tokens,
  Spinner,
  shorthands,
} from '@fluentui/react-components'
import { Search24Regular, DocumentBulletList24Regular } from '@fluentui/react-icons'
import { searchTickets, generateKBA } from '../../services/api'

// ============================================================================
// CALCULATIONS (Pure Functions)
// ============================================================================

/**
 * Format ticket status as a display string
 */
function formatStatus(status) {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

// ============================================================================
// COMPONENT
// ============================================================================

const useStyles = makeStyles({
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: tokens.spacingVerticalXXXL,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  welcomeSection: {
    marginBottom: tokens.spacingVerticalXXXL,
  },
  avatar: {
    width: '180px',
    height: '180px',
    ...shorthands.borderRadius('50%'),
    backgroundColor: '#5B8FD8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto',
    marginBottom: tokens.spacingVerticalXL,
    fontSize: '90px',
  },
  greeting: {
    fontSize: '32px',
    fontWeight: 400,
    color: '#444444',
    marginBottom: tokens.spacingVerticalM,
  },
  subtitle: {
    fontSize: '16px',
    color: '#666666',
    lineHeight: '1.6',
    marginBottom: tokens.spacingVerticalL,
    maxWidth: '700px',
  },
  instruction: {
    fontSize: '14px',
    color: '#888888',
    lineHeight: '1.6',
    marginBottom: tokens.spacingVerticalXXL,
    maxWidth: '700px',
  },
  searchSection: {
    width: '100%',
    maxWidth: '800px',
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalXXL,
  },
  searchInput: {
    flexGrow: 1,
  },
  resultsContainer: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingHorizontalL,
    marginTop: tokens.spacingVerticalXL,
  },
  resultCard: {
    height: 'fit-content',
    borderRadius: '8px',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.1)',
    textAlign: 'left',
  },
  kbaCard: {
    height: 'fit-content',
    borderRadius: '8px',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.1)',
    textAlign: 'left',
  },
  fieldRow: {
    marginBottom: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
  },
  fieldLabel: {
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    marginBottom: tokens.spacingVerticalXXS,
    fontSize: tokens.fontSizeBase300,
  },
  fieldValue: {
    color: tokens.colorNeutralForeground1,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontSize: tokens.fontSizeBase300,
  },
  emptyState: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXXXL,
    color: tokens.colorNeutralForeground3,
  },
  errorState: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXL,
    color: tokens.colorPaletteRedForeground1,
  },
  loadingState: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXXXL,
  },
  generateButton: {
    marginTop: tokens.spacingVerticalM,
  },
})

export default function TicketSearch() {
  const styles = useStyles()

  // ============================================================================
  // STATE
  // ============================================================================

  const [searchQuery, setSearchQuery] = useState('')
  const [ticket, setTicket] = useState(null)
  const [kba, setKba] = useState(null)
  const [loading, setLoading] = useState(false)
  const [kbaLoading, setKbaLoading] = useState(false)
  const [error, setError] = useState(null)
  const [kbaError, setKbaError] = useState(null)
  const [searched, setSearched] = useState(false)

  // ============================================================================
  // ACTIONS (Event Handlers)
  // ============================================================================

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      return
    }

    setLoading(true)
    setError(null)
    setTicket(null)
    setKba(null)
    setKbaError(null)
    setSearched(true)

    try {
      const result = await searchTickets(searchQuery.trim())
      
      // API returns {ticket: null} when not found
      if (result && result.ticket === null) {
        setTicket(null)
      } else {
        setTicket(result)
        // Auto-generate KBA when ticket is found
        if (result) {
          handleGenerateKBA(result)
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to search for ticket')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateKBA = async (ticketData = ticket) => {
    if (!ticketData) return

    setKbaLoading(true)
    setKbaError(null)

    try {
      const result = await generateKBA(ticketData)
      setKba(result)
    } catch (err) {
      const errorMsg = err.message || 'Failed to generate KBA'
      
      // Check if it's an Ollama connection error
      if (errorMsg.includes('Ollama') || errorMsg.includes('11434')) {
        setKbaError('Ollama LLM ist nicht verfügbar. Bitte starten Sie Ollama mit: ollama serve')
      } else {
        setKbaError(errorMsg)
      }
    } finally {
      setKbaLoading(false)
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleSearch()
    }
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={styles.container}>
      {/* Welcome Section */}
      {!searched && (
        <div className={styles.welcomeSection}>
          <div className={styles.avatar}>🤖</div>
          <h1 className={styles.greeting}>Guten Tag</h1>
          <p className={styles.subtitle}>
            Schön, dich hier zu sehen. Ich bin KBA Coach, dein digitaler Assistent.
          </p>
          <p className={styles.instruction}>
            Anstatt hier einfach Suchbegriffe einzutippen, gib mir eine Ticket-ID - 
            dann kann ich dir einen passenden Knowledge Base Artikel generieren!
          </p>
        </div>
      )}

      {/* Search Section */}
      <div className={styles.searchSection}>
        <Input
          className={styles.searchInput}
          placeholder="Stelle deine Frage oder gib eine Ticket-ID ein..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          data-testid="ticket-search-input"
          size="large"
        />
        <Button
          appearance="primary"
          icon={<Search24Regular />}
          onClick={handleSearch}
          disabled={loading || !searchQuery.trim()}
          data-testid="ticket-search-button"
          size="large"
        >
          Suchen
        </Button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className={styles.loadingState}>
          <Spinner size="large" label="Searching for ticket..." />
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className={styles.errorState}>
          <Text size={400}>❌ {error}</Text>
        </div>
      )}

      {/* Not Found State */}
      {searched && !loading && !error && !ticket && (
        <div className={styles.emptyState}>
          <Text size={400}>No ticket found for &quot;{searchQuery}&quot;</Text>
        </div>
      )}

      {/* Empty State (Initial) */}
      {!searched && !loading && (
        <div className={styles.emptyState}>
          <Text size={400}>Enter a ticket ID or search term to find tickets</Text>
        </div>
      )}

      {/* Result Cards - Two columns */}
      {ticket && !loading && (
        <div className={styles.resultsContainer}>
          {/* Left Column: Ticket Details */}
          <Card className={styles.resultCard} data-testid="ticket-result-card">
            <CardHeader
              header={
                <Text weight="semibold" size={500}>
                  Ticket {ticket.id}
                </Text>
              }
              description={
                <Text size={300}>
                  Status: {formatStatus(ticket.status)}
                </Text>
              }
            />

            <div style={{ padding: tokens.spacingVerticalM }}>
              {/* Assignee */}
              <div className={styles.fieldRow}>
                <Text className={styles.fieldLabel}>Zugewiesen an:</Text>
                <Text className={styles.fieldValue}>
                  {ticket.assignee || 'Nicht zugewiesen'}
                </Text>
              </div>

              {/* Summary */}
              <div className={styles.fieldRow}>
                <Text className={styles.fieldLabel}>Zusammenfassung:</Text>
                <Text className={styles.fieldValue}>
                  {ticket.summary || 'Keine Zusammenfassung'}
                </Text>
              </div>

              {/* Description */}
              <div className={styles.fieldRow}>
                <Text className={styles.fieldLabel}>Beschreibung:</Text>
                <Text className={styles.fieldValue}>
                  {ticket.description || 'Keine Beschreibung'}
                </Text>
              </div>

              {/* Resolution */}
              <div className={styles.fieldRow}>
                <Text className={styles.fieldLabel}>Lösung:</Text>
                <Text className={styles.fieldValue}>
                  {ticket.resolution || 'Keine Lösung'}
                </Text>
              </div>
            </div>
          </Card>

          {/* Right Column: KBA */}
          <Card className={styles.kbaCard} data-testid="kba-card">
            <CardHeader
              header={
                <Text weight="semibold" size={500}>
                  Knowledge Base Artikel
                </Text>
              }
              description={
                <Text size={300}>
                  Automatisch generiert aus Ticket-Informationen
                </Text>
              }
            />

            <div style={{ padding: tokens.spacingVerticalM }}>
              {/* KBA Loading State */}
              {kbaLoading && (
                <div style={{ textAlign: 'center', padding: tokens.spacingVerticalXL }}>
                  <Spinner size="medium" label="KBA wird generiert..." />
                </div>
              )}

              {/* KBA Error State */}
              {kbaError && !kbaLoading && (
                <div style={{ textAlign: 'center', padding: tokens.spacingVerticalL }}>
                  <Text size={400} style={{ color: tokens.colorPaletteRedForeground1 }}>
                    ❌ {kbaError}
                  </Text>
                  <Button
                    appearance="secondary"
                    icon={<DocumentBulletList24Regular />}
                    onClick={() => handleGenerateKBA()}
                    className={styles.generateButton}
                  >
                    Erneut generieren
                  </Button>
                </div>
              )}

              {/* KBA Content */}
              {kba && !kbaLoading && (
                <>
                  <div className={styles.fieldRow}>
                    <Text className={styles.fieldLabel}>Titel:</Text>
                    <Text className={styles.fieldValue} weight="semibold">
                      {kba.title}
                    </Text>
                  </div>

                  <div className={styles.fieldRow}>
                    <Text className={styles.fieldLabel}>Frage:</Text>
                    <Text className={styles.fieldValue}>
                      {kba.question}
                    </Text>
                  </div>

                  <div className={styles.fieldRow}>
                    <Text className={styles.fieldLabel}>Antwort:</Text>
                    <Text className={styles.fieldValue}>
                      {kba.answer}
                    </Text>
                  </div>

                  <Button
                    appearance="secondary"
                    icon={<DocumentBulletList24Regular />}
                    onClick={() => handleGenerateKBA()}
                    className={styles.generateButton}
                  >
                    Neu generieren
                  </Button>
                </>
              )}

              {/* KBA Empty State */}
              {!kba && !kbaLoading && !kbaError && (
                <div style={{ textAlign: 'center', padding: tokens.spacingVerticalXL }}>
                  <Text size={400} style={{ color: tokens.colorNeutralForeground3 }}>
                    KBA wird automatisch generiert...
                  </Text>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
