"""
End-to-end test for the agent_builder module via REST endpoints.

Adapted from the original test_workbench_integration_e2e.py to use the new
agent_builder Blueprint and services.
"""

import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

# Ensure backend modules are importable when running this file directly.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import app as backend_app_module
from agent_builder import WorkbenchService
from agent_builder.routes import configure_blueprint
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
        user_message = ""
        messages = _payload.get("messages", [])
        if messages:
            first = messages[0]
            if isinstance(first, (list, tuple)) and len(first) >= 2:
                user_message = str(first[1])

        tool = next(
            (item for item in self._tools if getattr(item, "name", "") == "csv_ticket_stats"),
            None,
        )
        if tool is None:
            raise AssertionError("csv_ticket_stats was not resolved")

        stats = await tool.ainvoke({})
        total = stats.get("total", 0) if isinstance(stats, dict) else 0
        output = f"Used csv_ticket_stats successfully. total={total}. context={user_message}"
        return {
            "messages": [
                _ToolCallMessage("csv_ticket_stats"),
                _FinalMessage(output),
            ]
        }


def _fake_build_react_agent(_llm: object, tools: list[object], _prompt: str) -> _FakeReactAgent:
    if "GitHub-flavored Markdown" not in _prompt:
        raise AssertionError("Expected markdown instruction in runtime system prompt")
    return _FakeReactAgent(tools)


class AgentBuilderE2ETests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self._tmpdir = TemporaryDirectory()
        self._original_service = backend_app_module.workbench_service

        test_service = WorkbenchService(
            tool_registry=_tool_registry,
            db_path=Path(self._tmpdir.name) / "e2e-test.db",
            openai_api_key="test-key",
        )
        test_service._llm = object()

        # Rewire the blueprint to use the test service
        backend_app_module.workbench_service = test_service
        configure_blueprint(
            workbench_service=test_service,
            get_operation_fn=backend_app_module.get_operation,
        )

    async def asyncTearDown(self) -> None:
        backend_app_module.workbench_service = self._original_service
        configure_blueprint(
            workbench_service=self._original_service,
            chat_service=getattr(backend_app_module, "chat_service", None),
            get_operation_fn=backend_app_module.get_operation,
        )
        self._tmpdir.cleanup()

    async def test_create_run_and_evaluate_agent(self) -> None:
        with patch("agent_builder.service.build_react_agent", new=_fake_build_react_agent):
            async with backend_app_module.app.test_app() as test_app:
                client = test_app.test_client()

                # UI config
                resp = await client.get("/api/workbench/ui-config")
                self.assertEqual(resp.status_code, 200)
                data = await resp.get_json()
                self.assertIn("tool_called", data["criteria_types"])
                self.assertIn("completed", data["run_statuses"])

                # List tools
                resp = await client.get("/api/workbench/tools")
                self.assertEqual(resp.status_code, 200)
                tools = await resp.get_json()
                tool_names = [t["name"] for t in tools["tools"]]
                self.assertIn("csv_ticket_stats", tool_names)

                # Create agent
                create_payload = {
                    "name": "E2E Test Agent",
                    "system_prompt": "Use csv_ticket_stats and report total.",
                    "tool_names": ["csv_ticket_stats"],
                    "success_criteria": [
                        {"type": "tool_called", "value": "csv_ticket_stats", "description": ""},
                        {"type": "output_contains", "value": "total=", "description": ""},
                    ],
                }
                resp = await client.post("/api/workbench/agents", json=create_payload)
                agent_data = await resp.get_json()
                self.assertEqual(resp.status_code, 201, agent_data)
                agent_id = agent_data["id"]

                # Run agent
                resp = await client.post(
                    f"/api/workbench/agents/{agent_id}/runs",
                    json={"input_prompt": "Get CSV ticket total."},
                )
                run_data = await resp.get_json()
                self.assertEqual(resp.status_code, 200, run_data)
                self.assertEqual(run_data["status"], "completed")
                self.assertIn("csv_ticket_stats", run_data["tools_used"])
                self.assertIn("total=", run_data["output"] or "")

                # Evaluate
                resp = await client.post(f"/api/workbench/runs/{run_data['id']}/evaluate")
                eval_data = await resp.get_json()
                self.assertEqual(resp.status_code, 200, eval_data)
                self.assertTrue(eval_data["overall_passed"])
                self.assertEqual(eval_data["score"], 1.0)

                # Delete agent
                resp = await client.delete(f"/api/workbench/agents/{agent_id}")
                self.assertEqual(resp.status_code, 200)

    async def test_required_input_validation(self) -> None:
        with patch("agent_builder.service.build_react_agent", new=_fake_build_react_agent):
            async with backend_app_module.app.test_app() as test_app:
                client = test_app.test_client()

                # Missing description should fail
                resp = await client.post("/api/workbench/agents", json={
                    "name": "Bad",
                    "system_prompt": "x",
                    "requires_input": True,
                    "required_input_description": "",
                    "tool_names": ["csv_ticket_stats"],
                })
                self.assertEqual(resp.status_code, 400)

                # Valid requires_input agent
                resp = await client.post("/api/workbench/agents", json={
                    "name": "Input Agent",
                    "system_prompt": "Use CSV tools.",
                    "requires_input": True,
                    "required_input_description": "Ticket INC number",
                    "tool_names": ["csv_ticket_stats"],
                })
                agent_data = await resp.get_json()
                self.assertEqual(resp.status_code, 201, agent_data)
                agent_id = agent_data["id"]

                # Run without required input should fail
                resp = await client.post(
                    f"/api/workbench/agents/{agent_id}/runs",
                    json={"input_prompt": ""},
                )
                self.assertEqual(resp.status_code, 400)

                # Run with required input should succeed
                resp = await client.post(
                    f"/api/workbench/agents/{agent_id}/runs",
                    json={"required_input_value": "INC-12345"},
                )
                run_data = await resp.get_json()
                self.assertEqual(resp.status_code, 200, run_data)
                self.assertEqual(run_data["status"], "completed")
                self.assertIn("INC-12345", run_data["output"] or "")


if __name__ == "__main__":
    unittest.main()
