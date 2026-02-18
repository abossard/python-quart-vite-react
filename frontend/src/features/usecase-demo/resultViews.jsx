import { Text } from '@fluentui/react-components'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function ResultTableView({ run, styles }) {
  const hasRows = Boolean(run?.result_rows?.length && run?.result_columns?.length)
  if (!hasRows) {
    return <Text>No structured table rows were found in this run.</Text>
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {run.result_columns.map((column) => (
              <th key={column} className={styles.th}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {run.result_rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 ? styles.rowAlt : ''}>
              {run.result_columns.map((column) => (
                <td key={`${rowIndex}-${column}`} className={styles.td}>
                  {String(row[column] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ResultMarkdownView({ markdown, styles }) {
  if (!markdown) {
    return <Text>No narrative summary was returned for this run.</Text>
  }

  return (
    <div className={styles.markdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {markdown}
      </ReactMarkdown>
    </div>
  )
}

function parseKBAFromRun(run) {
  // Try to extract KBA from result_rows first
  if (run?.result_rows?.length > 0) {
    const firstRow = run.result_rows[0]
    if (firstRow.ticket_id && firstRow.title && firstRow.question && firstRow.answer) {
      return {
        ticket_id: firstRow.ticket_id,
        title: firstRow.title,
        question: firstRow.question,
        answer: firstRow.answer,
      }
    }
  }

  // Try to parse from markdown JSON blocks
  if (run?.result_markdown) {
    const jsonMatch = run.result_markdown.match(/```json\s*(\{[\s\S]*?\})\s*```/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1])
        if (parsed.title && parsed.question && parsed.answer) {
          return parsed
        }
      } catch (e) {
        // Fall through to return null
      }
    }
  }

  return null
}

function ResultKBAArticleView({ run, styles }) {
  const kba = parseKBAFromRun(run)

  if (!kba) {
    return <Text>Kein KBA-Artikel gefunden. Bitte versuchen Sie es mit einer gültigen Ticket-ID.</Text>
  }

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#f5f5f5', 
        borderRadius: '8px',
        borderLeft: '4px solid #0078d4'
      }}>
        <Text style={{ fontSize: '20px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
          {kba.title}
        </Text>
        {kba.ticket_id && (
          <Text style={{ fontSize: '12px', color: '#666', display: 'block' }}>
            Quelle: Ticket {kba.ticket_id}
          </Text>
        )}
      </div>

      <div style={{ 
        padding: '16px', 
        backgroundColor: '#fff', 
        border: '1px solid #e5e5e5',
        borderRadius: '8px'
      }}>
        <Text style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '8px', color: '#0078d4' }}>
          ❓ Frage
        </Text>
        <Text style={{ fontSize: '14px', lineHeight: '1.6', display: 'block', whiteSpace: 'pre-wrap' }}>
          {kba.question}
        </Text>
      </div>

      <div style={{ 
        padding: '16px', 
        backgroundColor: '#fff', 
        border: '1px solid #e5e5e5',
        borderRadius: '8px'
      }}>
        <Text style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '8px', color: '#107c10' }}>
          ✅ Antwort
        </Text>
        <Text style={{ fontSize: '14px', lineHeight: '1.6', display: 'block', whiteSpace: 'pre-wrap' }}>
          {kba.answer}
        </Text>
      </div>
    </div>
  )
}

function ResultTicketDetailsView({ run, styles }) {
  // Try to extract ticket info from the agent result
  // The agent should have called csv_get_ticket and the result may contain ticket details
  if (!run?.result_markdown) {
    return <Text>Keine Ticket-Details verfügbar.</Text>
  }

  // Parse ticket info from markdown - look for ticket fields in the markdown
  const ticketIdMatch = run.result_markdown.match(/ticket[_-]?id[:\s]+([A-Z0-9]+)/i)
  const summaryMatch = run.result_markdown.match(/summary[:\s]+(.+?)(?:\n|$)/i)
  const statusMatch = run.result_markdown.match(/status[:\s]+(.+?)(?:\n|$)/i)
  const priorityMatch = run.result_markdown.match(/priority[:\s]+(.+?)(?:\n|$)/i)

  const hasAnyInfo = ticketIdMatch || summaryMatch || statusMatch || priorityMatch

  if (!hasAnyInfo) {
    return (
      <div style={{ padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <Text style={{ fontSize: '14px', color: '#666' }}>
          Ticket-Details werden während der KBA-Generierung erfasst.
        </Text>
      </div>
    )
  }

  return (
    <div style={{ 
      padding: '16px', 
      backgroundColor: '#fff', 
      border: '1px solid #e5e5e5',
      borderRadius: '8px',
      display: 'grid',
      gap: '12px'
    }}>
      {ticketIdMatch && (
        <div>
          <Text style={{ fontSize: '12px', fontWeight: 600, display: 'block', color: '#666' }}>
            Ticket-ID
          </Text>
          <Text style={{ fontSize: '14px', display: 'block' }}>
            {ticketIdMatch[1]}
          </Text>
        </div>
      )}
      {summaryMatch && (
        <div>
          <Text style={{ fontSize: '12px', fontWeight: 600, display: 'block', color: '#666' }}>
            Zusammenfassung
          </Text>
          <Text style={{ fontSize: '14px', display: 'block' }}>
            {summaryMatch[1]}
          </Text>
        </div>
      )}
      {statusMatch && (
        <div>
          <Text style={{ fontSize: '12px', fontWeight: 600, display: 'block', color: '#666' }}>
            Status
          </Text>
          <Text style={{ fontSize: '14px', display: 'block' }}>
            {statusMatch[1]}
          </Text>
        </div>
      )}
      {priorityMatch && (
        <div>
          <Text style={{ fontSize: '12px', fontWeight: 600, display: 'block', color: '#666' }}>
            Priorität
          </Text>
          <Text style={{ fontSize: '14px', display: 'block' }}>
            {priorityMatch[1]}
          </Text>
        </div>
      )}
    </div>
  )
}

export const RESULT_VIEW_REGISTRY = {
  table: {
    title: 'Structured Table',
    description: 'Structured fields extracted from the run output.',
    render: (props) => <ResultTableView {...props} />,
  },
  markdown: {
    title: 'Narrative Summary',
    description: 'Human-readable summary from the run output.',
    render: (props) => <ResultMarkdownView {...props} />,
  },
  kba_article: {
    title: 'KBA-Artikel',
    description: 'Generierter Knowledge Base Artikel mit Titel, Frage und Antwort.',
    render: (props) => <ResultKBAArticleView {...props} />,
  },
  ticket_details: {
    title: 'Quell-Ticket',
    description: 'Details des ursprünglichen Support-Tickets.',
    render: (props) => <ResultTicketDetailsView {...props} />,
  },
}
