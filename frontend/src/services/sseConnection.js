/**
 * SSE Connection — Singleton FSM with pub/sub
 *
 * One EventSource shared across the entire app.
 * Multiple consumers subscribe/unsubscribe; the connection
 * opens on first subscriber and closes on last unsubscribe.
 *
 * States & legal transitions:
 *   IDLE → CONNECTING → CONNECTED ⇄ RECONNECTING → CONNECTING
 *   (any) → CLOSED  (when last subscriber leaves)
 *
 * Only declared transitions are allowed; all others are no-ops.
 */

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------
export const SSE_STATE = Object.freeze({
  IDLE: "idle",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  RECONNECTING: "reconnecting",
  CLOSED: "closed",
});

// ---------------------------------------------------------------------------
// Transition table
// ---------------------------------------------------------------------------
const TRANSITIONS = {
  [SSE_STATE.IDLE]: new Set([SSE_STATE.CONNECTING, SSE_STATE.CLOSED]),
  [SSE_STATE.CONNECTING]: new Set([
    SSE_STATE.CONNECTED,
    SSE_STATE.RECONNECTING,
    SSE_STATE.CLOSED,
  ]),
  [SSE_STATE.CONNECTED]: new Set([SSE_STATE.RECONNECTING, SSE_STATE.CLOSED]),
  [SSE_STATE.RECONNECTING]: new Set([SSE_STATE.CONNECTING, SSE_STATE.CLOSED]),
  [SSE_STATE.CLOSED]: new Set([SSE_STATE.CONNECTING]), // can restart after closed
};

const INITIAL_DELAY = 1000;
const MAX_DELAY = 30000;

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------
let state = SSE_STATE.IDLE;
let eventSource = null;
let reconnectDelay = INITIAL_DELAY;
let reconnectTimer = null;
const subscribers = new Set(); // Set<{ onEvent, onStateChange }>

// ---------------------------------------------------------------------------
// FSM internals
// ---------------------------------------------------------------------------
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
  const url = "/api/workbench/events";
  console.log(`[SSE] opening EventSource: ${url}`);

  eventSource = new EventSource(url);

  eventSource.onopen = () => {
    console.log("[SSE] EventSource.onopen");
    reconnectDelay = INITIAL_DELAY;
    transitionTo(SSE_STATE.CONNECTED);
  };

  eventSource.onmessage = (raw) => {
    try {
      const data = JSON.parse(raw.data);
      console.log("[SSE] event:", data.type, data.runId?.slice(0, 8));
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
    console.log(`[SSE] retry in ${reconnectDelay}ms`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      open();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
  };
}

function teardown() {
  transitionTo(SSE_STATE.CLOSED);
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Subscribe to the shared SSE connection.
 * Opens the connection on first subscriber.
 * Connection stays alive even when subscribers drop to 0
 * (avoids Firefox connection-limit issues from React strict mode teardown/remount).
 *
 * @param {{ onEvent: (data: object) => void, onStateChange: (state: string) => void }} callbacks
 * @returns {() => void} unsubscribe function
 */
export function subscribeSSE({ onEvent, onStateChange }) {
  const sub = { onEvent, onStateChange };
  subscribers.add(sub);
  console.log(`[SSE] subscribe (${subscribers.size} subs, state=${state})`);

  // Notify new subscriber of current state immediately
  onStateChange(state);

  // Start connection if not already running
  if (state === SSE_STATE.IDLE || state === SSE_STATE.CLOSED) {
    open();
  }

  return () => {
    subscribers.delete(sub);
    console.log(`[SSE] unsubscribe (${subscribers.size} subs)`);
    // Connection stays alive — singleton for the app lifetime.
    // Heartbeats keep it cheap. Avoids Firefox blocking on rapid teardown/reconnect.
  };
}

/** Get current FSM state */
export function getSSEState() {
  return state;
}
