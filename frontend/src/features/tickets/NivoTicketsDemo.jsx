import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveLine } from '@nivo/line';
import { ResponsivePie } from '@nivo/pie';
import { useMemo, useState } from 'react';
import { ticketsByPriority, ticketsByStatus, ticketsTimelineSeries } from './sampleTickets';

const panels = {
  status: { label: 'By Status', component: StatusPie },
  priority: { label: 'By Priority', component: PriorityBar },
  timeline: { label: 'Timeline', component: TimelineLine },
};

export function NivoTicketsDemo({ height = 420 }) {
  const [panel, setPanel] = useState('status');
  const ActivePanel = panels[panel].component;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {Object.entries(panels).map(([key, { label }]) => (
          <button
            key={key}
            onClick={() => setPanel(key)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: panel === key ? '2px solid #2563eb' : '1px solid #ccc',
              background: panel === key ? '#dbeafe' : '#fff',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ height }}>
        <ActivePanel />
      </div>
    </div>
  );
}

function StatusPie() {
  const data = useMemo(() => ticketsByStatus, []);
  return (
    <ResponsivePie
      data={data}
      margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
      innerRadius={0.5}
      padAngle={1}
      cornerRadius={4}
      activeOuterRadiusOffset={8}
      colors={{ scheme: 'category10' }}
      borderWidth={1}
      borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
      arcLinkLabelsSkipAngle={10}
      arcLinkLabelsTextColor="#2d3748"
      arcLinkLabelsThickness={2}
      arcLinkLabelsColor={{ from: 'color' }}
      arcLabelsSkipAngle={10}
      arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
      legends={[
        {
          anchor: 'bottom',
          direction: 'row',
          justify: false,
          translateX: 0,
          translateY: 56,
          itemsSpacing: 8,
          itemWidth: 100,
          itemHeight: 18,
          itemTextColor: '#4a5568',
          itemDirection: 'left-to-right',
          itemOpacity: 1,
          symbolSize: 12,
          symbolShape: 'circle',
        },
      ]}
    />
  );
}

function PriorityBar() {
  const data = useMemo(() => ticketsByPriority, []);
  return (
    <ResponsiveBar
      data={data}
      keys={['count']}
      indexBy="priority"
      margin={{ top: 40, right: 20, bottom: 48, left: 60 }}
      padding={0.3}
      colors={{ scheme: 'set2' }}
      borderRadius={4}
      axisBottom={{
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        legend: 'Priority',
        legendPosition: 'middle',
        legendOffset: 32,
      }}
      axisLeft={{
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        legend: 'Tickets',
        legendPosition: 'middle',
        legendOffset: -40,
      }}
      labelSkipWidth={12}
      labelSkipHeight={12}
      labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
      animate
    />
  );
}

function TimelineLine() {
  const data = useMemo(() => ticketsTimelineSeries, []);
  return (
    <ResponsiveLine
      data={data}
      margin={{ top: 40, right: 20, bottom: 60, left: 60 }}
      xScale={{ type: 'point' }}
      yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false, reverse: false }}
      axisBottom={{
        orient: 'bottom',
        tickSize: 5,
        tickPadding: 5,
        tickRotation: -35,
        legend: 'Reported Date',
        legendOffset: 46,
        legendPosition: 'middle',
      }}
      axisLeft={{
        orient: 'left',
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        legend: 'Tickets',
        legendOffset: -50,
        legendPosition: 'middle',
      }}
      colors={{ scheme: 'category10' }}
      lineWidth={3}
      pointSize={8}
      pointColor={{ theme: 'background' }}
      pointBorderWidth={2}
      pointBorderColor={{ from: 'serieColor' }}
      pointLabelYOffset={-12}
      useMesh={true}
      enableArea={true}
      areaOpacity={0.15}
      animate
    />
  );
}

export default NivoTicketsDemo;
