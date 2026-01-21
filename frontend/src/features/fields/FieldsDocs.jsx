import { Caption1, Card, CardHeader, makeStyles, Spinner, Subtitle1, Text, tokens } from '@fluentui/react-components'
import { useEffect, useState } from 'react'
import { getCSVTicketFields } from '../../services/api'

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  tableWrapper: {
    overflowX: 'auto',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: tokens.fontSizeBase200,
  },
  th: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    textAlign: 'left',
    backgroundColor: tokens.colorNeutralBackground3,
    borderBottom: `2px solid ${tokens.colorNeutralStroke1}`,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    maxWidth: '320px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tr: {
    ':nth-child(even)': {
      backgroundColor: tokens.colorNeutralBackground2,
    },
  },
})

export default function FieldsDocs() {
  const styles = useStyles()
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await getCSVTicketFields()
        setFields(data.fields || [])
      } catch (err) {
        setError(err?.message || 'Failed to load fields')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className={styles.container}>
      <div>
        <Subtitle1>CSV Ticket Fields</Subtitle1>
        <Caption1>Fetched from API: `/csv-tickets/fields`</Caption1>
      </div>

      {loading && (
        <Spinner label="Loading fields..." />
      )}

      {error && (
        <Text>{error}</Text>
      )}

      {!loading && !error && (
        <Card>
          <CardHeader header={<Text weight="semibold">Available Fields ({fields.length})</Text>} />
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Name</th>
                  <th className={styles.th}>Label</th>
                  <th className={styles.th}>Type</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field.name} className={styles.tr}>
                    <td className={styles.td}>{field.name}</td>
                    <td className={styles.td}>{field.label || '—'}</td>
                    <td className={styles.td}>{field.type || 'string'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
