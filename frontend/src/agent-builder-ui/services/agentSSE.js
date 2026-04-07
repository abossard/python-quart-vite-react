/**
 * Agent SSE Connection — Singleton FSM with pub/sub
 *
 * One EventSource shared across the entire app.
 * Multiple consumers subscribe/unsubscribe; the connection
 * opens on first subscriber and stays alive for the app lifetime.
 *
 * States & legal transitions:
 *   IDLE → CONNECTING → CONNECTED ⇄ RECONNECTING → CONNECTING
 *   (any) → CLOSED
 *   CLOSED → CONNECTING (can restart)
 */

export const SSE_STATE = Object.freeze({
  IDLE: "idle",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  RECONNECTING: "reconnecting",
  CLOSED: "closed",
});

const TRANSITIONS = {
  [SSE_STATE.IDLE]: new Set([SSE_STATE.CONNECTING, SSE_STATE.CLOSED]),
  [SSE_STATE.CONNECTING]: new Set([
    SSE_STATE.CONNECTED,
    SSE_STATE.RECONNECTING,
    SSE_STATE.CLOSED,
  ]),
  [SSE_STATE.CONNECTED]: new Set([SSE_STATE.RECONNECTING, SSE_STATE.CLOSED]),
  [SSE_STATE.RECONNECTING]: new Set([SSE_STATE.CONNECTING, SSE_STATE.CLOSED]),
  [SSE_STATE.CLOSED]: new Set([SSE_STATE.CONNECTING]),
};

const INITIAL_DELAY = 1000;
const MAX_DELAY = 30000;
const DEFAULT_SSE_URL = "/api/workbench/events";

let sseUrl = DEFAULT_SSE_URL;
let state = SSE_STATE.IDLE;
let eventSource = null;
let reconnectDelay = INITIAL_DELAY;
let reconnectTimer = null;
const subscribers = new Set();

function transitionTo(nextState) {
  if (state === nextState) return false;
  const allowed = TRANSITIONS[state];
  if (!allowed || !allowed.has(nextState)) {
    console.warn(`[SSE] illegal transition ${state} → ${nextState} — ignored`);
    return false;
  }
  const prev = state;
  state = nextState;
  console.log(`[SSE] ${prev} → ${nextState} (${subscribers.size} subs)`);
  for (const sub of subscribers) {
    sub.onStateChange(state);
  }
  return true;
}

function open() {
  if (!transitionTo(SSE_STATE.CONNECTING)) return;
  console.log(`[SSE] opening EventSource: ${sseUrl}`);

  eventSource = new EventSource(sseUrl);

  eventSource.onopen = () => {
    reconnectDelay = INITIAL_DELAY;
    transitionTo(SSE_STATE.CONNECTED);
  };

  eventSource.onmessage = (raw) => {
    try {
      const data = JSON.parse(raw.data);
      for (const sub of subscribers) {
        sub.onEvent(data);
      }
    } catch (_) {
      // malformed JSON — skip
    }
  };

  eventSource.onerror = () => {
    console.warn("[SSE] EventSource.onerror");
    eventSource.close();
    eventSource = null;
    if (!transitionTo(SSE_STATE.RECONNECTING)) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      open();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
  };
}

/**
 * Configure the SSE endpoint URL. Call before any subscriptions.
 * @param {string} url - SSE endpoint URL (default: /api/workbench/events)
 */
export function configureSSE(url) {
  sseUrl = url;
}

/**
 * Subscribe to the shared SSE connection.
 * Opens the connection on first subscriber.
 *
 * @param {{ onEvent: (data: object) => void, onStateChange: (state: string) => void }} callbacks
 * @returns {() => void} unsubscribe function
 */
export function subscribeSSE({ onEvent, onStateChange }) {
  const sub = { onEvent, onStateChange };
  subscribers.add(sub);
  onStateChange(state);

  if (state === SSE_STATE.IDLE || state === SSE_STATE.CLOSED) {
    open();
  }

  return () => {
    subscribers.delete(sub);
  };
}

/** Get current FSM state */
export function getSSEState() {
  return state;
}
