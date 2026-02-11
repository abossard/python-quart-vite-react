import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from agents import AgentResponse
from usecase_demo import UsecaseDemoRunCreate, UsecaseDemoRunService, UsecaseDemoRunStatus
import usecase_demo


class UsecaseDemoRunServiceTests(unittest.IsolatedAsyncioTestCase):
    async def _wait_for_terminal_state(self, service: UsecaseDemoRunService, run_id: str) -> object:
        deadline = asyncio.get_running_loop().time() + 2.0
        while asyncio.get_running_loop().time() < deadline:
            run = await service.get_run(run_id)
            if run and run.status in (UsecaseDemoRunStatus.COMPLETED, UsecaseDemoRunStatus.FAILED):
                return run
            await asyncio.sleep(0.01)
        self.fail("run did not reach terminal state in time")

    async def test_run_completes_with_rows(self):
        service = UsecaseDemoRunService()
        mock_response = AgentResponse(
            result=(
                "## Summary\nVPN incidents grouped.\n\n"
                "```json\n"
                "{\"rows\":[{\"menu_point\":\"VPN Stability\",\"project_name\":\"VPN Early Warning\"}]}\n"
                "```"
            ),
            agent_type="task_assistant",
            tools_used=["csv_search_tickets"],
            error=None,
        )

        with patch.object(usecase_demo.agent_service, "run_agent", new=AsyncMock(return_value=mock_response)):
            created = await service.create_run(UsecaseDemoRunCreate(prompt='Find tickets mentioning "VPN"'))
            run = await self._wait_for_terminal_state(service, created.id)

        self.assertEqual(run.status, UsecaseDemoRunStatus.COMPLETED)
        self.assertEqual(len(run.result_rows), 1)
        self.assertIn("menu_point", run.result_columns)
        self.assertEqual(run.result_rows[0]["project_name"], "VPN Early Warning")

    async def test_run_fails_on_timeout(self):
        service = UsecaseDemoRunService()

        async def slow_run_agent(_request):
            await asyncio.sleep(0.2)
            return AgentResponse(result="slow", agent_type="task_assistant")

        with patch.object(usecase_demo, "USECASE_DEMO_AGENT_TIMEOUT_SECONDS", 0.05):
            with patch.object(
                usecase_demo.agent_service,
                "run_agent",
                new=AsyncMock(side_effect=slow_run_agent),
            ):
                created = await service.create_run(UsecaseDemoRunCreate(prompt="Find VPN tickets"))
                run = await self._wait_for_terminal_state(service, created.id)

        self.assertEqual(run.status, UsecaseDemoRunStatus.FAILED)
        self.assertIsNotNone(run.error)
        self.assertIn("timed out", run.error.lower())


if __name__ == "__main__":
    unittest.main()
