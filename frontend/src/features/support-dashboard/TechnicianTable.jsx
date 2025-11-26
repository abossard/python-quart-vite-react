/**
 * TechnicianTable Component
 *
 * DataGrid displaying technician performance metrics
 * Shows name, tickets resolved, avg time, rating, and status
 */

import {
  Card,
  CardHeader,
  Text,
  DataGrid,
  DataGridBody,
  DataGridRow,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  TableCellLayout,
  createTableColumn,
  makeStyles,
  tokens,
  Badge,
  Spinner,
} from '@fluentui/react-components'
import {
  Person20Regular,
  Checkmark20Regular,
  Clock20Regular,
  Star20Filled,
} from '@fluentui/react-icons'

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalL,
  },
  header: {
    marginBottom: tokens.spacingVerticalM,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
  },
  nameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  rating: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorPaletteYellowForeground1,
  },
})

// ============================================================================
// CALCULATIONS - Pure functions
// ============================================================================

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
}

function getStatusColor(status) {
  const statusMap = {
    online: 'success',
    away: 'warning',
    offline: 'subtle',
  }
  return statusMap[status] || 'subtle'
}

function getStatusLabel(status) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function TechnicianTable({ data, loading = false }) {
  const styles = useStyles()

  if (loading) {
    return (
      <Card className={styles.card}>
        <div className={styles.loading}>
          <Spinner label="Loading technician data..." />
        </div>
      </Card>
    )
  }

  const technicians = data || []

  // Define columns
  const columns = [
    createTableColumn({
      columnId: 'name',
      renderHeaderCell: () => 'Technician',
      renderCell: (tech) => (
        <TableCellLayout media={<Person20Regular />}>
          <Text weight="semibold">{tech.name}</Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'resolved',
      renderHeaderCell: () => 'Resolved (24h)',
      renderCell: (tech) => (
        <TableCellLayout media={<Checkmark20Regular />}>
          <Text>{tech.resolved_24h}</Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'avgTime',
      renderHeaderCell: () => 'Avg Time',
      renderCell: (tech) => (
        <TableCellLayout media={<Clock20Regular />}>
          <Text>{formatTime(tech.avg_time_minutes)}</Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'rating',
      renderHeaderCell: () => 'Rating',
      renderCell: (tech) => (
        <TableCellLayout>
          <div className={styles.rating}>
            <Star20Filled />
            <Text>{tech.rating.toFixed(1)}</Text>
          </div>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: 'status',
      renderHeaderCell: () => 'Status',
      renderCell: (tech) => (
        <TableCellLayout>
          <Badge
            appearance="filled"
            color={getStatusColor(tech.status)}
          >
            {getStatusLabel(tech.status)}
          </Badge>
        </TableCellLayout>
      ),
    }),
  ]

  return (
    <Card className={styles.card}>
      <CardHeader
        header={
          <div className={styles.header}>
            <Text size={400} weight="semibold">
              Technician Performance
            </Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              {technicians.length} team members
            </Text>
          </div>
        }
      />
      
      {technicians.length === 0 ? (
        <div className={styles.loading}>
          <Text>No technician data available</Text>
        </div>
      ) : (
        <DataGrid
          items={technicians}
          columns={columns}
          sortable
          getRowId={(item, index) => `tech-${index}`}
        >
          <DataGridHeader>
            <DataGridRow>
              {({ renderHeaderCell }) => (
                <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
              )}
            </DataGridRow>
          </DataGridHeader>
          <DataGridBody>
            {({ item, rowId }) => (
              <DataGridRow key={rowId}>
                {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
              </DataGridRow>
            )}
          </DataGridBody>
        </DataGrid>
      )}
    </Card>
  )
}
