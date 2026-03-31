/**
 * useRunManager — Central finite state machine for agent run lifecycle.
 *
 * Single source of truth for all runs. Manages:
 *  - Run state via Map<runId, RunState>
 *  - SSE subscription for real-time updates
 *  - Activity event collection per run
 *  - API calls (start, list, delete)
 *
 * State transitions (per run):
 *   RUNNING → COMPLETED | FAILED | TRUNCATED
 *
 * Unidirectional flow: SSE events drive state changes.
 * Components read state, never mutate directly.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  connectToAgentEvents,
  deleteAllRuns,
  getRun,
  listAllRuns,
  runWorkbenchAgent,
} from "../../services/api";
import { SSE_STATE } from "../../services/sseConnection";

// ---------------------------------------------------------------------------
// FSM State definitions (pure data)
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = new Set(["completed", "failed", "truncated"]);

function isTerminal(status) {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Create initial RunState from a run API response.
 * @param {object} run - Run object from API
 * @returns {{ run: object, activityEvents: object[], status: string }}
 */
function createRunState(run) {
  return {
    run,
    status: run.status,
    activityEvents: run.activity_log || [],
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export default function useRunManager() {
  // Map<runId, RunState> — keyed for O(1) lookups
  const [runMap, setRunMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const sseCleanupRef = useRef(null);

  // ------------------------------------------------------------------
  // Derived: sorted array of runs (newest first)
  // ------------------------------------------------------------------
  const runs = Array.from(runMap.values())
    .map((rs) => rs.run)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  // ------------------------------------------------------------------
  // Load initial runs from API
  // ------------------------------------------------------------------
  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAllRuns();
      const newMap = new Map();
      for (const run of data.runs || []) {
        newMap.set(run.id, createRunState(run));
      }
      setRunMap(newMap);
    } catch (err) {
      console.error("[useRunManager] Failed to load runs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ------------------------------------------------------------------
  // Start a new run (fire-and-forget — returns immediately with RUNNING)
  // ------------------------------------------------------------------
  const startRun = useCallback(
    async (agentId, { inputPrompt = "", requiredInputValue = "" } = {}) => {
      const run = await runWorkbenchAgent(agentId, {
        inputPrompt,
        requiredInputValue,
      });
      setRunMap((prev) => {
        const next = new Map(prev);
        next.set(run.id, createRunState(run));
        return next;
      });
      return run;
    },
    [],
  );

  // ------------------------------------------------------------------
  // Refresh a single run from the API (e.g. after SSE says it finished)
  // ------------------------------------------------------------------
  const refreshRun = useCallback(async (runId) => {
    try {
      const run = await getRun(runId);
      setRunMap((prev) => {
        const next = new Map(prev);
        const existing = prev.get(runId);
        next.set(runId, {
          run,
          status: run.status,
          // Merge: prefer server activity_log if available, else keep collected events
          activityEvents:
            run.activity_log?.length > 0
              ? run.activity_log
              : existing?.activityEvents || [],
        });
        return next;
      });
    } catch (err) {
      console.error("[useRunManager] Failed to refresh run:", runId, err);
    }
  }, []);

  // ------------------------------------------------------------------
  // Delete all runs
  // ------------------------------------------------------------------
  const clearAllRuns = useCallback(async () => {
    try {
      await deleteAllRuns();
      setRunMap(new Map());
    } catch (err) {
      console.error("[useRunManager] Failed to delete runs:", err);
    }
  }, []);

  // ------------------------------------------------------------------
  // Get activity events for a specific run
  // ------------------------------------------------------------------
  const getRunActivity = useCallback(
    (runId) => {
      return runMap.get(runId)?.activityEvents || [];
    },
    [runMap],
  );

  // ------------------------------------------------------------------
  // Get a single run's state
  // ------------------------------------------------------------------
  const getRunState = useCallback(
    (runId) => {
      return runMap.get(runId) || null;
    },
    [runMap],
  );

  // ------------------------------------------------------------------
  // SSE subscription — single connection for all runs
  // ------------------------------------------------------------------
  useEffect(() => {
    // Clean up previous subscription
    if (sseCleanupRef.current) {
      sseCleanupRef.current();
    }

    const cleanup = connectToAgentEvents(
      (event) => {
        const runId = event.runId || event.threadId;
        if (!runId) return;

        setRunMap((prev) => {
          const existing = prev.get(runId);
          if (!existing) {
            if (event.type === "RUN_STARTED") {
              const next = new Map(prev);
              next.set(runId, {
                run: {
                  id: runId,
                  agent_id: event.agentId || "",
                  status: "running",
                  input_prompt: event.inputPreview || "",
                  created_at: new Date().toISOString(),
                  agent_snapshot: { name: event.agentName || "Agent" },
                  tools_used: [],
                  activity_log: [],
                },
                status: "running",
                activityEvents: [event],
              });
              return next;
            }
            return prev;
          }

          const next = new Map(prev);
          const updatedEvents = [...existing.activityEvents, event];

          switch (event.type) {
            case "RUN_FINISHED":
              next.set(runId, {
                ...existing,
                status: event.truncated ? "truncated" : "completed",
                activityEvents: updatedEvents,
              });
              break;

            case "RUN_ERROR":
              next.set(runId, {
                ...existing,
                status: "failed",
                activityEvents: updatedEvents,
              });
              break;

            default:
              next.set(runId, {
                ...existing,
                activityEvents: updatedEvents,
              });
              break;
          }

          return next;
        });

        // After terminal events, refresh from API to get full output
        if (event.type === "RUN_FINISHED" || event.type === "RUN_ERROR") {
          setTimeout(() => refreshRun(runId), 300);
        }
      },
      (sseState) => {
        if (sseState === SSE_STATE.CONNECTED) {
          loadRuns();
        }
      },
    );

    sseCleanupRef.current = cleanup;

    return () => {
      if (sseCleanupRef.current) {
        sseCleanupRef.current();
        sseCleanupRef.current = null;
      }
    };
  }, [refreshRun]);

  // Initial load
  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  return {
    /** Sorted array of run objects (newest first) */
    runs,
    /** Whether initial load is in progress */
    loading,
    /** Start a new run — returns immediately with RUNNING run */
    startRun,
    /** Reload all runs from API */
    loadRuns,
    /** Delete all runs */
    clearAllRuns,
    /** Get activity events for a run */
    getRunActivity,
    /** Get full RunState for a run */
    getRunState,
    /** Refresh a single run from API */
    refreshRun,
  };
}
