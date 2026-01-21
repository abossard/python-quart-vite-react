import { Subtitle1, Text } from '@fluentui/react-components'
import NivoTicketsDemo from '../tickets/NivoTicketsDemo'
import SankeyTicketsDemo from '../tickets/SankeyTicketsDemo'
import StreamTicketsDemo from '../tickets/StreamTicketsDemo'

export default function KitchenSink() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, padding: '24px 0' }}>
      <div>
        <Subtitle1>Kitchen Sink Demo</Subtitle1>
        <Text>
          Ticket visualizations with Nivo panels, plus Sankey (status → priority flows) and Stream (stacked trends).
        </Text>
      </div>

      <section>
        <Subtitle1>Status / Priority / Timeline</Subtitle1>
        <div style={{ height: 420 }}>
          <NivoTicketsDemo />
        </div>
      </section>

      <section>
        <Subtitle1>Sankey — Status to Priority</Subtitle1>
        <div style={{ height: 420 }}>
          <SankeyTicketsDemo />
        </div>
      </section>

      <section>
        <Subtitle1>Stream — Status Over Time</Subtitle1>
        <div style={{ height: 420 }}>
          <StreamTicketsDemo />
        </div>
      </section>
    </div>
  )
}
