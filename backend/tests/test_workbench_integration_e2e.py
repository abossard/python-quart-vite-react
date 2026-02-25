"""End-to-end verification for workbench_integration via REST endpoints."""

import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

# Ensure backend modules are importable when running this file directly.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import app as backend_app_module
from agent_workbench import WorkbenchService
from workbench_integration import _tool_registry


class _ToolCallMessage:
    def __init__(self, tool_name: str) -> None:
        self.tool_calls = [{"name": tool_name}]


class _FinalMessage:
    def __init__(self, content: str) -> None:
        self.content = content


class _FakeReactAgent:
    def __init__(self, tools: list[object]) -> None:
        self._tools = tools

    async def ainvoke(self, _payload: dict, config: dict | None = None) -> dict:
        _ = config
        tool = next(
            (item for item in self._tools if getattr(item, "name", "") == "csv_ticket_stats"),
            None,
        )
        if tool is None:
            raise AssertionError("csv_ticket_stats was not resolved from workbench registry")

        stats = await tool.ainvoke({})
        total = stats.get("total", 0) if isinstance(stats, dict) else 0
        output = f"Used csv_ticket_stats successfully. total={total}"
        return {
            "messages": [
                _ToolCallMessage("csv_ticket_stats"),
                _FinalMessage(output),
            ]
        }


def _fake_build_react_agent(_llm: object, tools: list[object], _prompt: str) -> _FakeReactAgent:
    return _FakeReactAgent(tools)


class WorkbenchIntegrationE2ETests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self._tmpdir = TemporaryDirectory()
        self._original_service = backend_app_module.workbench_service

        backend_app_module.workbench_service = WorkbenchService(
            tool_registry=_tool_registry,
            db_path=Path(self._tmpdir.name) / "workbench-e2e.db",
            openai_api_key="test-key",
        )
        # Avoid any real network/model dependency in this end-to-end API flow test.
        backend_app_module.workbench_service._llm = object()

    async def asyncTearDown(self) -> None:
        backend_app_module.workbench_service = self._original_service
        self._tmpdir.cleanup()

    async def test_create_run_and_evaluate_agent_with_csv_tool(self) -> None:
        with patch("agent_workbench.service._build_react_agent", new=_fake_build_react_agent):
            async with backend_app_module.app.test_app() as test_app:
                client = test_app.test_client()

                ui_config_resp = await client.get("/api/workbench/ui-config")
                self.assertEqual(ui_config_resp.status_code, 200)
                ui_config_data = await ui_config_resp.get_json()
                endpoint_paths = [endpoint["path"] for endpoint in ui_config_data["endpoints"]]
                self.assertIn("/api/workbench/agents", endpoint_paths)
                self.assertIn("/api/workbench/agents/{agent_id}/runs", endpoint_paths)
                self.assertIn("/api/workbench/runs/{run_id}/evaluate", endpoint_paths)
                self.assertIn("tool_called", ui_config_data["criteria_types"])
                self.assertIn("completed", ui_config_data["run_statuses"])

                tools_resp = await client.get("/api/workbench/tools")
                self.assertEqual(tools_resp.status_code, 200)
                tools_payload = await tools_resp.get_json()
                tool_names = [tool["name"] for tool in tools_payload["tools"]]
                self.assertIn("csv_ticket_stats", tool_names)
                self.assertIn("csv_ticket_fields", tool_names)
                self.assertFalse(any(name.startswith("list_task") for name in tool_names))
                self.assertFalse(any(name.startswith("create_task") for name in tool_names))
                self.assertFalse(any(name.startswith("workbench_") for name in tool_names))

                list_tickets_tool = next(
                    item for item in tools_payload["tools"] if item["name"] == "csv_list_tickets"
                )
                input_props = list_tickets_tool.get("input_schema", {}).get("properties", {})
                self.assertIn("status", input_props)
                self.assertIn("limit", input_props)

                create_payload = {
                    "name": "CSV stats verifier",
                    "description": "E2E check for workbench integration",
                    "system_prompt": "Use csv_ticket_stats and report total.",
                    "tool_names": ["csv_ticket_stats"],
                    "success_criteria": [
                        {
                            "type": "tool_called",
                            "value": "csv_ticket_stats",
                            "description": "Agent must call csv_ticket_stats",
                        },
                        {
                            "type": "output_contains",
                            "value": "total=",
                            "description": "Output should contain total count",
                        },
                    ],
                }
                create_resp = await client.post("/api/workbench/agents", json=create_payload)
                create_data = await create_resp.get_json()
                self.assertEqual(create_resp.status_code, 201, create_data)
                agent_id = create_data["id"]

                run_resp = await client.post(
                    f"/api/workbench/agents/{agent_id}/runs",
                    json={"input_prompt": "Get me the current CSV ticket total."},
                )
                run_data = await run_resp.get_json()
                self.assertEqual(run_resp.status_code, 200, run_data)
                self.assertEqual(run_data["status"], "completed")
                self.assertIn("csv_ticket_stats", run_data["tools_used"])
                self.assertIn("total=", run_data["output"] or "")
                self.assertIn("csv_ticket_stats", run_data["agent_snapshot"].get("tool_names", []))

                evaluate_resp = await client.post(f"/api/workbench/runs/{run_data['id']}/evaluate")
                evaluate_data = await evaluate_resp.get_json()
                self.assertEqual(evaluate_resp.status_code, 200, evaluate_data)
                self.assertTrue(evaluate_data["overall_passed"])
                self.assertEqual(evaluate_data["score"], 1.0)


if __name__ == "__main__":
    unittest.main()
