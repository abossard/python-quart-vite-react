/**
 * useRunManager — Central FSM for agent run lifecycle.
 *
 * Single source of truth for all runs. Manages:
 *  - Run state via Map<runId, RunState>
 *  - SSE subscription for real-time updates
 *  - Activity event collection per run
 *  - API calls (start, list, delete)
 *
 * State transitions (per run):
 *   RUNNING → COMPLETED | FAILED | TRUNCATED
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeSSE, SSE_STATE } from "../services/agentSSE";
import {
  deleteAllRuns,
  getRun,
  listAllRuns,
  startRun as apiStartRun,
} from "../services/agentApi";

const TERMINAL_STATUSES = new Set(["completed", "failed", "truncated"]);

function isTerminal(status) {
  return TERMINAL_STATUSES.has(status);
}

function createRunState(run) {
  return {
    run,
    status: run.status,
    activityEvents: run.activity_log || [],
  };
}

export default function useRunManager() {
  const [runMap, setRunMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const sseCleanupRef = useRef(null);

  const runs = Array.from(runMap.values())
    .map((rs) => rs.run)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

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

  const startRun = useCallback(
    async (agentId, { inputPrompt = "", requiredInputValue = "" } = {}) => {
      const run = await apiStartRun(agentId, {
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

  const refreshRun = useCallback(async (runId) => {
    try {
      const run = await getRun(runId);
      setRunMap((prev) => {
        const next = new Map(prev);
        const existing = prev.get(runId);
        next.set(runId, {
          run,
          status: run.status,
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

  const clearAllRuns = useCallback(async () => {
    try {
      await deleteAllRuns();
      setRunMap(new Map());
    } catch (err) {
      console.error("[useRunManager] Failed to delete runs:", err);
    }
  }, []);

  const getRunActivity = useCallback(
    (runId) => {
      return runMap.get(runId)?.activityEvents || [];
    },
    [runMap],
  );

  const getRunState = useCallback(
    (runId) => {
      return runMap.get(runId) || null;
    },
    [runMap],
  );

  useEffect(() => {
    if (sseCleanupRef.current) {
      sseCleanupRef.current();
    }

    const cleanup = subscribeSSE({
      onEvent: (event) => {
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

        if (event.type === "RUN_FINISHED" || event.type === "RUN_ERROR") {
          setTimeout(() => refreshRun(runId), 300);
        }
      },
      onStateChange: (sseState) => {
        if (sseState === SSE_STATE.CONNECTED) {
          loadRuns();
        }
      },
    });

    sseCleanupRef.current = cleanup;

    return () => {
      if (sseCleanupRef.current) {
        sseCleanupRef.current();
        sseCleanupRef.current = null;
      }
    };
  }, [refreshRun]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  return {
    runs,
    loading,
    startRun,
    loadRuns,
    clearAllRuns,
    getRunActivity,
    getRunState,
    refreshRun,
  };
}
