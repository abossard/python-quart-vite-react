/**
 * useAgentManager — Agent CRUD + tools + UI config state.
 *
 * Consolidates the loading logic scattered across WorkbenchPage
 * into a single reusable hook.
 */

import { useCallback, useEffect, useState } from "react";
import {
  listAgents,
  listTools,
  getUiConfig,
  createAgent as apiCreateAgent,
  updateAgent as apiUpdateAgent,
  deleteAgent as apiDeleteAgent,
} from "../services/agentApi";

export default function useAgentManager() {
  const [agents, setAgents] = useState([]);
  const [tools, setTools] = useState([]);
  const [uiConfig, setUiConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [configData, toolsData, agentsData] = await Promise.all([
        getUiConfig().catch(() => null),
        listTools().catch(() => ({ tools: [] })),
        listAgents().catch(() => ({ agents: [] })),
      ]);
      setUiConfig(configData);
      setTools(toolsData.tools || []);
      setAgents(agentsData.agents || []);
    } catch (err) {
      console.error("[useAgentManager] Failed to load:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createAgent = useCallback(
    async (agentData) => {
      const result = await apiCreateAgent(agentData);
      await refresh();
      return result;
    },
    [refresh],
  );

  const updateAgent = useCallback(
    async (agentId, agentData) => {
      const result = await apiUpdateAgent(agentId, agentData);
      await refresh();
      return result;
    },
    [refresh],
  );

  const deleteAgent = useCallback(
    async (agentId) => {
      await apiDeleteAgent(agentId);
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
    },
    [],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    agents,
    tools,
    uiConfig,
    loading,
    createAgent,
    updateAgent,
    deleteAgent,
    refresh,
  };
}
