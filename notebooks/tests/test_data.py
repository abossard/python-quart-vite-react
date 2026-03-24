"""Tests for the DATA layer — signatures and dataset loaders."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import dspy
import pytest
from dspy_tasks.data import (
    ClassifySentiment, ExtractEntities, SummarizeText, TranslateEnDe, FormatData,
    SolveMath, LogicalDeduction, GenerateCode, CompleteAnalogy, VerifyFact,
    MultiHopQA, ClassifyTicket, GenerateReport, ComparativeAnalysis, FollowInstructions,
    SolveWithCalculator, SearchAndSynthesize, MultiToolTask, PlanAndExecute, SelfCorrectingTask,
    load_dataset, split_dataset,
)

ALL_SIGNATURES = [
    ClassifySentiment, ExtractEntities, SummarizeText, TranslateEnDe, FormatData,
    SolveMath, LogicalDeduction, GenerateCode, CompleteAnalogy, VerifyFact,
    MultiHopQA, ClassifyTicket, GenerateReport, ComparativeAnalysis, FollowInstructions,
    SolveWithCalculator, SearchAndSynthesize, MultiToolTask, PlanAndExecute, SelfCorrectingTask,
]


class TestSignatures:
    """All 20 signatures should be valid dspy.Signature subclasses."""

    @pytest.mark.parametrize("sig", ALL_SIGNATURES, ids=[s.__name__ for s in ALL_SIGNATURES])
    def test_is_signature(self, sig):
        assert issubclass(sig, dspy.Signature)

    @pytest.mark.parametrize("sig", ALL_SIGNATURES, ids=[s.__name__ for s in ALL_SIGNATURES])
    def test_has_fields(self, sig):
        fields = sig.model_fields
        assert len(fields) >= 2, f"{sig.__name__} needs at least 1 input + 1 output"


DATASET_FILES = [
    ("sentiment.json", ["review"]),
    ("entities.json", ["sentence"]),
    ("summarization.json", ["article"]),
    ("math_word_problems.json", ["question"]),
    ("ticket_routing.json", ["summary"]),
]


class TestDatasets:
    """Dataset files should load correctly."""

    @pytest.mark.parametrize("filename,input_fields", DATASET_FILES)
    def test_load_dataset(self, filename, input_fields):
        examples = load_dataset(filename, input_fields)
        assert len(examples) >= 5, f"{filename} should have at least 5 examples"
        for ex in examples:
            assert hasattr(ex, "inputs")
            assert len(ex.inputs()) > 0

    def test_split_dataset(self):
        examples = load_dataset("sentiment.json", ["review"])
        train, dev = split_dataset(examples, 0.7)
        assert len(train) + len(dev) == len(examples)
        assert len(train) > len(dev)
