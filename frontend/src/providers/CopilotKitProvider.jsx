/**
 * CopilotKit Provider
 *
 * Wraps Agent Fabric routes with CopilotKit context for AG-UI communication.
 * Deep module: hides protocol details, exposes simple provider interface.
 *
 * Data: agent config (runtimeUrl, agentId)
 * Action: establishes AG-UI SSE connection to backend
 */

import { CopilotKit } from '@copilotkit/react-core'
import '@copilotkit/react-ui/styles.css'

export default function CopilotKitProvider({ agentId, threadId, children }) {
  return (
    <CopilotKit
      runtimeUrl="/api/workbench/ag-ui"
      agent={agentId || undefined}
      threadId={threadId || undefined}
    >
      {children}
    </CopilotKit>
  )
}
