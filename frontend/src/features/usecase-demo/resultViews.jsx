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
}
