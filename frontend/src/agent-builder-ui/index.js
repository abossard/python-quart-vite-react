/**
 * Agent Builder UI — Public API
 *
 * Reusable hooks, utilities, and SSE services for building
 * agent-powered UIs. Import from this barrel module.
 */

// Services
export { SSE_STATE, subscribeSSE, getSSEState, configureSSE } from "./services/agentSSE";
export * as agentApi from "./services/agentApi";

// Hooks
export { default as useRunManager } from "./hooks/useRunManager";
export { default as useAgentManager } from "./hooks/useAgentManager";

// Utils
export { parseRunOutput } from "./utils/outputUtils";
export { buildModelOptions } from "./utils/modelOptions";
export { formatTime, shortId, eventSummary, eventDetail } from "./utils/eventFormatters";
