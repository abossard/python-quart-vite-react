"""Tests for the task registry — integration of data + calculations + tasks."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from dspy_tasks.tasks import TASK_REGISTRY, list_tasks, list_by_tier, get_task, task_summary


class TestRegistry:
    def test_has_20_tasks(self):
        assert len(TASK_REGISTRY) == 20

    def test_list_tasks_returns_all(self):
        assert len(list_tasks()) == 20

    def test_tiers_have_5_each(self):
        for tier in range(1, 5):
            assert len(list_by_tier(tier)) == 5, f"Tier {tier} should have 5 tasks"

    def test_get_task_by_id(self):
        task = get_task("sentiment")
        assert task.name == "Sentiment Classification"
        assert task.tier == 1

    def test_get_task_invalid_raises(self):
        with pytest.raises(KeyError):
            get_task("nonexistent_task")

    def test_task_summary_format(self):
        summaries = task_summary()
        assert len(summaries) == 20
        for s in summaries:
            assert "id" in s
            assert "name" in s
            assert "tier" in s
            assert "difficulty" in s


class TestTaskDataclasses:
    @pytest.mark.parametrize("task_id", list(TASK_REGISTRY.keys()))
    def test_task_has_required_fields(self, task_id):
        task = get_task(task_id)
        assert task.id
        assert task.name
        assert task.tier in (1, 2, 3, 4)
        assert task.difficulty in ("easy", "medium", "hard", "agentic")
        assert task.description
        assert task.teaching_point
        assert task.signature_class is not None
        assert task.dataset_file
        assert len(task.input_fields) >= 1
        assert task.metric_id

    @pytest.mark.parametrize("task_id", list(TASK_REGISTRY.keys()))
    def test_metric_exists_in_registry(self, task_id):
        task = get_task(task_id)
        assert callable(task.metric_fn)

    @pytest.mark.parametrize("task_id", [
        "sentiment", "math_word", "ticket_routing",
    ])
    def test_dataset_loads(self, task_id):
        task = get_task(task_id)
        examples = task.load_examples()
        assert len(examples) >= 5

    @pytest.mark.parametrize("task_id", [
        "sentiment", "math_word", "ticket_routing",
    ])
    def test_dataset_splits(self, task_id):
        task = get_task(task_id)
        train, dev = task.split_examples()
        assert len(train) > 0
        assert len(dev) > 0

    @pytest.mark.parametrize("task_id", [
        t for t, task in TASK_REGISTRY.items() if task.module_type != "ReAct"
    ])
    def test_module_instantiates(self, task_id):
        """Non-ReAct modules should instantiate without error."""
        task = get_task(task_id)
        module = task.make_module()
        assert module is not None
