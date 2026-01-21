import { ResponsiveStream } from '@nivo/stream'
import { useMemo } from 'react'
import { ticketsStreamData, ticketsStreamKeys } from './sampleTickets'

export default function StreamTicketsDemo({ height = 420 }) {
  const data = useMemo(() => ticketsStreamData, [])
  const keys = useMemo(() => ticketsStreamKeys, [])

  return (
    <div style={{ height }}>
      <ResponsiveStream
        data={data}
        keys={keys}
        margin={{ top: 40, right: 20, bottom: 60, left: 60 }}
        axisTop={null}
        axisRight={null}
        axisBottom={{
          orient: 'bottom',
          tickSize: 5,
          tickPadding: 5,
          tickRotation: -35,
          legend: 'Date',
          legendOffset: 50,
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
        offsetType="wiggle"
        fillOpacity={0.85}
        borderColor={{ theme: 'background' }}
        dotSize={8}
        dotColor={{ from: 'color', modifiers: [['darker', 0.7]] }}
        dotBorderWidth={1}
        dotBorderColor={{ from: 'color', modifiers: [['darker', 0.3]] }}
        animate
        motionStiffness={90}
        motionDamping={12}
        legends={[
          {
            anchor: 'bottom',
            direction: 'row',
            translateY: 56,
            itemWidth: 82,
            itemHeight: 14,
            itemTextColor: '#555',
            symbolSize: 12,
            symbolShape: 'circle',
          },
        ]}
      />
    </div>
  )
}
