# 🧪 DSPy Prompt Tuning Playground

> **"Evaluation is the specification. Optimization is the compiler. Data is the source code."**

An interactive Jupyter notebook series that teaches **prompt tuning and optimization** using [DSPy](https://dspy.ai/) with multiple LLMs via [LiteLLM](https://docs.litellm.ai/). Learn why **evaluation + tuning is the "software engineering" of the AI era**.

## Quick Start

```bash
# From the project root
source .venv/bin/activate
pip install -r notebooks/requirements.txt

# Launch Jupyter
cd notebooks
jupyter lab
```

Open `00_introduction.ipynb` and follow the learning path.

## Learning Path

| # | Notebook | Concept | Tasks |
|---|----------|---------|-------|
| 00 | **The Shift** | Setup + first taste of DSPy | — |
| 01 | **Data, Calculations, Actions** | Grokking Simplicity for LLMs | 1-3 |
| 02 | **Deep Modules** | A Philosophy of Software Design: module depth | 4-7 |
| 03 | **Evaluation as Specification** | Metrics ARE your software specification | 8-10 |
| 04 | **The Optimizer Is Your Compiler** | BootstrapFewShot + MIPROv2 optimization | 11-13 |
| 05 | **Your Data Is Your Moat** | Domain tuning with real ticket data | 14-15 |
| 06 | **Agentic Optimization** | ReAct agents with tool use | 16-20 |
| 07 | **The Full Picture** | Cross-model showdown + ROI | All 20 |

## The 20 Tasks

### Tier 1: Fundamentals ★☆☆☆
1. Sentiment Classification
2. Entity Extraction
3. Text Summarization
4. English → German Translation
5. Format Compliance

### Tier 2: Reasoning ★★☆☆
6. Math Word Problems (ChainOfThought)
7. Logical Deduction
8. Code Generation
9. Analogy Completion
10. Fact Verification

### Tier 3: Composition ★★★☆
11. Multi-Hop QA
12. **Ticket Classification** (uses your CSV data!)
13. Report Generation
14. Comparative Analysis
15. Instruction Following with Constraints

### Tier 4: Agentic ★★★★
16. Calculator Agent (ReAct)
17. Search & Synthesize Agent
18. Multi-Tool Orchestration
19. Plan-and-Execute
20. Self-Correcting Agent

## Architecture

Following **Grokking Simplicity**, the shared library separates:

```
dspy_tasks/
├── data.py           # DATA: Signatures + dataset loaders (pure declarations)
├── calculations.py   # CALCULATIONS: 20 metric functions (pure, no I/O)
├── actions.py        # ACTIONS: run_baseline, run_optimization (I/O)
├── tools.py          # ACTIONS: tool functions for agentic tasks
├── visualize.py      # ACTIONS: ipywidgets + Plotly display helpers
└── tasks/            # Task definitions (dataclasses, no behavior)
    ├── tier1_basics.py
    ├── tier2_reasoning.py
    ├── tier3_composition.py
    └── tier4_agentic.py
```

## Models

Uses any LiteLLM-compatible model. Default options:

```python
AVAILABLE_MODELS = [
    "github_copilot/gpt-4o",        # strong baseline
    "github_copilot/gpt-4o-mini",   # cheap — shows optimization value
    "github_copilot/claude-sonnet-4", # different architecture
]
```

## Running Tests

```bash
cd notebooks
python -m pytest tests/ -v
```

## Prerequisites

- Python 3.10+
- Project virtual environment (`.venv`)
- Access to at least one LLM model via LiteLLM (GitHub Copilot models work with no API key)
