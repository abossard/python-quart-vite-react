"""
Tier 3: Complex Composition — "Can it compose multiple steps?"

Tasks 11-15: Multi-step reasoning, domain-specific classification, structured generation.
These tasks show the value of domain data and composite metrics.
"""
from .tier1_basics import PlaygroundTask
from ..data import (
    MultiHopQA, ClassifyTicket, GenerateReport, ComparativeAnalysis, FollowInstructions,
)

TIER_3_TASKS = [
    PlaygroundTask(
        id="multihop_qa",
        name="Multi-Hop QA",
        tier=3,
        difficulty="hard",
        description="Answer questions requiring 2-3 reasoning hops across a passage.",
        teaching_point="DSPy's ChainOfThought shines here — manual prompts fail at multi-hop.",
        signature_class=MultiHopQA,
        dataset_file="multihop_qa.json",
        input_fields=("question", "context"),
        metric_id="multihop_qa",
        module_type="ChainOfThought",
        default_prompt="Read the context and answer the question.",
    ),
    PlaygroundTask(
        id="ticket_routing",
        name="Ticket Classification & Routing",
        tier=3,
        difficulty="hard",
        description="Classify IT support tickets by category, priority, and routing team.",
        teaching_point="Domain-specific data + tuning outperforms generic prompts. Your company's data is the moat.",
        signature_class=ClassifyTicket,
        dataset_file="ticket_routing.json",
        input_fields=("summary",),
        metric_id="ticket_routing",
        module_type="ChainOfThought",
        default_prompt="Classify this IT ticket.",
    ),
    PlaygroundTask(
        id="report_generation",
        name="Structured Report Generation",
        tier=3,
        difficulty="hard",
        description="Generate structured reports from data points.",
        teaching_point="JSON schema adherence varies wildly by model — tuning stabilizes output structure.",
        signature_class=GenerateReport,
        dataset_file="report_generation.json",
        input_fields=("data_points", "report_type"),
        metric_id="report_generation",
        module_type="ChainOfThought",
        default_prompt="Write a report from this data.",
    ),
    PlaygroundTask(
        id="comparative_analysis",
        name="Comparative Analysis",
        tier=3,
        difficulty="hard",
        description="Compare two items across multiple criteria and provide a recommendation.",
        teaching_point="Multi-aspect reasoning requires balanced coverage — metrics catch blind spots.",
        signature_class=ComparativeAnalysis,
        dataset_file="comparative_analysis.json",
        input_fields=("item_a", "item_b", "criteria"),
        metric_id="comparative_analysis",
        module_type="ChainOfThought",
        default_prompt="Compare these two items.",
    ),
    PlaygroundTask(
        id="instruction_constraints",
        name="Instruction Following with Constraints",
        tier=3,
        difficulty="hard",
        description="Complete a task while satisfying multiple explicit constraints.",
        teaching_point="Prompt tuning finds ways to encode constraints that zero-shot prompts miss.",
        signature_class=FollowInstructions,
        dataset_file="instruction_constraints.json",
        input_fields=("task", "constraints"),
        metric_id="instruction_constraints",
        module_type="ChainOfThought",
        default_prompt="Complete this task following all constraints.",
    ),
]
