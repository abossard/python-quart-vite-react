# Nivo Charts for Tickets

This repo is a learning sandbox for CSV ticket data. Use Nivo to visualize tickets with minimal setup.

## Installation

```bash
cd frontend
npm install @nivo/core @nivo/pie @nivo/bar @nivo/line @nivo/axes @nivo/legends
```

## Demo Component

`frontend/src/features/tickets/NivoTicketsDemo.jsx`

- Panels:
  - **Status (Pie)** – distribution across statuses
  - **Priority (Bar)** – counts per priority
  - **Timeline (Line)** – cumulative or daily counts over time
- Sample data: `frontend/src/features/tickets/sampleTickets.js`

## Usage

```jsx
import NivoTicketsDemo from '@/features/tickets/NivoTicketsDemo';

export function TicketsPage() {
  return (
    <div style={{ height: 420 }}>
      <NivoTicketsDemo />
    </div>
  );
}
```

## Wire in real data

1. **Fetch backend CSV** (or parse `csv/data.csv` server-side and expose an API).
2. **Map to aggregates**:
   - `ticketsByStatus`: `[ { id, label, value } ]`
   - `ticketsByPriority`: `[ { priority, count } ]`
   - `ticketsTimelineSeries`: `[ { id, data: [ { x: date, y: count } ] } ]`
3. **Pass props** to the component or replace `sampleTickets.js` with live data.

### Example aggregation (frontend)
```ts
import _groupBy from 'lodash/groupBy';

function toStatusPie(tickets) {
  const grouped = _groupBy(tickets, t => t.status || 'Unknown');
  return Object.entries(grouped).map(([status, items]) => ({
    id: status,
    label: status,
    value: items.length,
  }));
}
```

## Panels & layout

- Use the built-in panel switcher for multiple views.
- Wrap in Fluent UI `Card` or `Surface` for consistent theming.
- Keep heights fixed for responsive layouts (e.g., `height: 420`).

## Tips

- Dates should be ISO strings or consistent x-axis labels (`YYYY-MM-DD`).
- Keep datasets small for demos; paginate or filter for large CSVs.
- Customize colors: `colors={{ scheme: 'category10' }}` etc.
- Enable tooltips by default (Nivo provides them out-of-the-box).

## Next steps

- Replace sample data with real CSV aggregates.
- Add filters (date range, status, priority) to update charts.
- Add a table view to complement charts (e.g., `@fluentui/react-components` `Table`).

## Question to reader

**How would you like to view the tickets?**
- Status distribution?
- Priority breakdown?
- Time trends?
- Geographic (by city/country)?
- SLA compliance?

Let this guide which panels you build.
