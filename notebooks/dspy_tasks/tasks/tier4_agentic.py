"""
Tier 4: Agentic Behavior — "Can it use tools and plan?"

Tasks 16-20: Tasks requiring tool use via dspy.ReAct.
DSPy optimizes not just prompts but how agents decide to use tools.
"""
from .tier1_basics import PlaygroundTask
from ..data import (
    SolveWithCalculator, SearchAndSynthesize, MultiToolTask, PlanAndExecute, SelfCorrectingTask,
)

TIER_4_TASKS = [
    PlaygroundTask(
        id="calculator_agent",
        name="Calculator Agent",
        tier=4,
        difficulty="agentic",
        description="Solve math questions using a calculator tool.",
        teaching_point="Simplest agent task — shows tool selection optimization clearly.",
        signature_class=SolveWithCalculator,
        dataset_file="math_word_problems.json",  # reuse math dataset
        input_fields=("question",),
        metric_id="calculator_agent",
        module_type="ReAct",
        tools=("calculate",),
        default_prompt="Use the calculator to solve this math problem.",
    ),
    PlaygroundTask(
        id="search_agent",
        name="Search & Synthesize Agent",
        tier=4,
        difficulty="agentic",
        description="Search the ticket knowledge base and synthesize answers.",
        teaching_point="DSPy optimizes not just the prompt but how the agent decides to use tools.",
        signature_class=SearchAndSynthesize,
        dataset_file="search_agent_qa.json",
        input_fields=("question",),
        metric_id="search_agent",
        module_type="ReAct",
        tools=("search_tickets", "get_ticket_stats"),
        default_prompt="Search the ticket database to answer this question.",
    ),
    PlaygroundTask(
        id="multi_tool",
        name="Multi-Tool Orchestration",
        tier=4,
        difficulty="agentic",
        description="Orchestrate multiple tools to answer complex queries.",
        teaching_point="DSPy optimizes not just prompts but tool-use patterns — fewer calls, better results.",
        signature_class=MultiToolTask,
        dataset_file="search_agent_qa.json",
        input_fields=("question",),
        metric_id="multi_tool",
        module_type="ReAct",
        tools=("calculate", "search_tickets", "get_ticket_stats"),
        default_prompt="Use available tools to answer this complex query.",
    ),
    PlaygroundTask(
        id="plan_execute",
        name="Plan-and-Execute",
        tier=4,
        difficulty="agentic",
        description="Create a plan and execute it step by step to achieve a goal.",
        teaching_point="Full agentic loop — DSPy tunes the planning prompt for better decomposition.",
        signature_class=PlanAndExecute,
        dataset_file="search_agent_qa.json",
        input_fields=("question",),
        metric_id="plan_execute",
        module_type="ReAct",
        tools=("search_tickets", "get_ticket_stats", "calculate"),
        default_prompt="Plan how to achieve this goal, then execute the plan.",
    ),
    PlaygroundTask(
        id="self_correct",
        name="Self-Correcting Agent",
        tier=4,
        difficulty="agentic",
        description="Complete a task, verify the result, and self-correct if needed.",
        teaching_point="Evaluation-in-the-loop is the endgame — agents that check their own work.",
        signature_class=SelfCorrectingTask,
        dataset_file="search_agent_qa.json",
        input_fields=("question",),
        metric_id="self_correct",
        module_type="ReAct",
        tools=("search_tickets", "get_ticket_stats", "verify_answer"),
        default_prompt="Complete this task and verify your answer is correct.",
    ),
]
