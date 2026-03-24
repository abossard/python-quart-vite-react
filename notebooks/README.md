# 🧪 Prompt Tuning Playground

> **"Evaluation ist die Spezifikation. Optimierung ist der Compiler. Daten sind der Quellcode."**

Interaktive Jupyter-Notebooks die zeigen: **warum LLMs nicht perfekt sind**, **wie man Qualität misst**, und **wie automatische Optimierung besser ist als manuelles Prompt-Tuning**.

## Quick Start

```bash
cd notebooks && ./start.sh
# Oder manuell:
source .venv/bin/activate && pip install -r notebooks/requirements.txt
cd notebooks && jupyter lab
```

Open `01_evaluation_and_tuning.ipynb` and follow the learning path.

## Lernpfad

| # | Notebook | Was du lernst |
|---|----------|---------------|
| 01 | **Evaluation & Tuning** | Setup, LLM-Fehler sehen, Accuracy messen, selbst Prompts tunen |
| 02 | **Optimierung** | Erst manuell, dann automatisch — der Optimizer als Compiler |
| 03 | **Domain-Tuning** | Deine echten Daten + Tuning = dein Wettbewerbsvorteil |
| 04 | **Agenten** | Tool-nutzende Agenten optimieren |
| 05 | **Gesamtbild** | Cross-Model Showdown + Quiz |

### Optionale Appendix-Notebooks
| | Notebook | Thema |
|---|----------|-------|
| A | **Grokking Simplicity** | Code-Architektur: Data, Calculations, Actions |
| B | **Deep Modules** | Modultiefe: Predict → ChainOfThought → ReAct |

## Benchmarks & Datasets

Die Notebooks nutzen **validierte Industrie-Benchmarks**:
- **TruthfulQA** — Fragen die LLMs zum Halluzinieren verleiten
- **HotPotQA** — Multi-Hop Wissensfragen
- **MATH** — Mathematisches Reasoning
- **Eigene Ticket-Daten** — aus `csv/data.csv`

## Modelle

Erkennt automatisch verfügbare Modelle aus deiner `.env`-Konfiguration via LiteLLM:

```
github_copilot/gpt-4o, gpt-4o-mini, claude-sonnet-4, o3-mini, ...
```

## Tests

```bash
cd notebooks && python -m pytest tests/ -v
```

## Voraussetzungen

- Python 3.10+
- Zugang zu mindestens einem LLM via LiteLLM (GitHub Copilot funktioniert ohne API-Key)
