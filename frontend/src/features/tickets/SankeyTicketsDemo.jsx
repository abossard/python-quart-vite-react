import { ResponsiveSankey } from '@nivo/sankey'
import { useMemo } from 'react'
import { ticketsSankey } from './sampleTickets'

export default function SankeyTicketsDemo({ height = 420 }) {
  const data = useMemo(() => ticketsSankey, [])

  return (
    <div style={{ height }}>
      <ResponsiveSankey
        data={data}
        margin={{ top: 40, right: 120, bottom: 40, left: 50 }}
        align="justify"
        colors={{ scheme: 'paired' }}
        nodeOpacity={1}
        nodeThickness={18}
        nodeSpacing={16}
        nodeBorderWidth={0}
        nodeBorderColor={{ from: 'color', modifiers: [['darker', 0.8]] }}
        linkOpacity={0.5}
        linkHoverOpacity={0.7}
        linkBlendMode="multiply"
        enableLinkGradient={true}
        labelPosition="outside"
        labelOrientation="horizontal"
        labelPadding={12}
        labelTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
        legends={[
          {
            anchor: 'bottom-right',
            direction: 'column',
            translateX: 110,
            itemWidth: 100,
            itemHeight: 14,
            itemDirection: 'left-to-right',
            symbolSize: 12,
          },
        ]}
      />
    </div>
  )
}
