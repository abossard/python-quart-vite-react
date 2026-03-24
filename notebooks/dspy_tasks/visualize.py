"""
ACTIONS — Visualization and interactive widget helpers.

Following Grokking Simplicity: these are actions (I/O to display).
They render widgets and charts in Jupyter notebooks.
"""
import ipywidgets as widgets
from IPython.display import display, HTML, clear_output
import plotly.graph_objects as go
import plotly.express as px
from dataclasses import dataclass
from typing import Optional


# ============================================================================
# DATA CLASSES for results (pure data)
# ============================================================================

@dataclass
class RunResult:
    """Result of running a baseline evaluation."""
    task_id: str
    model: str
    score: float
    individual_scores: list[dict]  # [{input, expected, predicted, score}, ...]
    prompt_used: str
    elapsed_seconds: float
    llm_calls: int

@dataclass
class OptimizationResult:
    """Result of running DSPy optimization."""
    task_id: str
    model: str
    optimizer: str
    baseline_score: float
    optimized_score: float
    improvement: float
    improvement_pct: float
    prompt_before: str
    prompt_after: str
    trial_scores: list[float]
    elapsed_seconds: float
    llm_calls: int

@dataclass
class ComparisonResult:
    """Result of comparing models on a task."""
    task_id: str
    models: list[str]
    baseline_scores: dict[str, float]
    optimized_scores: dict[str, float]
    improvements: dict[str, float]


# ============================================================================
# WIDGET HELPERS
# ============================================================================

def model_picker(available_models: list[str], default: str = None) -> widgets.Dropdown:
    """Create a model selection dropdown."""
    return widgets.Dropdown(
        options=available_models,
        value=default or available_models[0],
        description='Model:',
        style={'description_width': 'initial'},
        layout=widgets.Layout(width='400px'),
    )

def multi_model_picker(available_models: list[str], defaults: list[str] = None) -> widgets.SelectMultiple:
    """Create a multi-model selection widget."""
    return widgets.SelectMultiple(
        options=available_models,
        value=defaults or available_models[:3],
        description='Models:',
        style={'description_width': 'initial'},
        layout=widgets.Layout(width='400px', height='120px'),
    )

def optimizer_picker() -> widgets.RadioButtons:
    """Create an optimizer selection widget."""
    return widgets.RadioButtons(
        options=[
            ('BootstrapFewShot (fast, ~10s)', 'BootstrapFewShot'),
            ('MIPROv2 (powerful, ~30-60s)', 'MIPROv2'),
        ],
        value='BootstrapFewShot',
        description='Optimizer:',
        style={'description_width': 'initial'},
    )

def task_picker(tasks: list[dict]) -> widgets.Dropdown:
    """Create a task selection dropdown with tier labels."""
    options = [(f"[Tier {t['tier']}] {t['name']}", t['id']) for t in tasks]
    return widgets.Dropdown(
        options=options,
        description='Task:',
        style={'description_width': 'initial'},
        layout=widgets.Layout(width='500px'),
    )

def run_button(description: str = "Run", button_style: str = "primary") -> widgets.Button:
    """Create a styled run button."""
    return widgets.Button(
        description=description,
        button_style=button_style,
        icon='play',
        layout=widgets.Layout(width='200px', height='40px'),
    )

def progress_bar(description: str = "Progress") -> widgets.FloatProgress:
    """Create a progress bar for optimization."""
    return widgets.FloatProgress(
        value=0, min=0, max=100,
        description=description,
        bar_style='info',
        style={'bar_color': '#0078d4', 'description_width': 'initial'},
        layout=widgets.Layout(width='500px'),
    )


# ============================================================================
# DISPLAY HELPERS
# ============================================================================

def score_badge(score: float) -> str:
    """Return an HTML badge for a score value."""
    if score >= 0.8:
        color, emoji = "#107c10", "🟢"
    elif score >= 0.5:
        color, emoji = "#ca5010", "🟡"
    else:
        color, emoji = "#d13438", "🔴"
    return f'{emoji} <span style="color:{color}; font-weight:bold; font-size:1.2em">{score:.1%}</span>'

def display_score(label: str, score: float):
    """Display a score with colored badge."""
    display(HTML(f'<div style="margin:8px 0"><b>{label}:</b> {score_badge(score)}</div>'))

def display_improvement(baseline: float, optimized: float):
    """Display improvement from baseline to optimized."""
    delta = optimized - baseline
    pct = (delta / max(baseline, 0.01)) * 100
    arrow = "↑" if delta > 0 else "↓" if delta < 0 else "→"
    color = "#107c10" if delta > 0 else "#d13438" if delta < 0 else "#605e5c"
    display(HTML(f'''
        <div style="background:#f3f2f1; padding:12px; border-radius:4px; margin:8px 0">
            <b>Improvement:</b> 
            <span style="color:{color}; font-size:1.3em; font-weight:bold">
                {arrow} {abs(delta):.1%} ({pct:+.1f}%)
            </span>
            <br>
            <span style="color:#605e5c">Baseline: {baseline:.1%} → Optimized: {optimized:.1%}</span>
        </div>
    '''))


# ============================================================================
# PROMPT DIFF VIEWER
# ============================================================================

def display_prompt_diff(before: str, after: str, title: str = "What DSPy Changed"):
    """Display side-by-side prompt comparison."""
    html = f'''
    <div style="margin:16px 0">
        <h3 style="color:#323130">{title}</h3>
        <div style="display:flex; gap:16px">
            <div style="flex:1; background:#fdf6f0; border:1px solid #edebe9; border-radius:4px; padding:12px">
                <h4 style="color:#ca5010; margin-top:0">Before (zero-shot)</h4>
                <pre style="white-space:pre-wrap; font-size:0.85em; color:#323130">{_escape_html(before)}</pre>
            </div>
            <div style="flex:1; background:#f0fdf0; border:1px solid #edebe9; border-radius:4px; padding:12px">
                <h4 style="color:#107c10; margin-top:0">After (DSPy optimized)</h4>
                <pre style="white-space:pre-wrap; font-size:0.85em; color:#323130">{_escape_html(after)}</pre>
            </div>
        </div>
    </div>
    '''
    display(HTML(html))

def _escape_html(text: str) -> str:
    """Escape HTML special characters."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ============================================================================
# RESULTS TABLE
# ============================================================================

def display_results_table(results: list[dict], max_rows: int = 20):
    """Display per-example results as an HTML table.
    
    Each dict should have: input, expected, predicted, score
    """
    rows = ""
    for i, r in enumerate(results[:max_rows]):
        score = r.get("score", 0)
        icon = "✅" if score >= 0.8 else "⚠️" if score >= 0.5 else "❌"
        bg = "#f0fdf0" if score >= 0.8 else "#fdf6f0" if score >= 0.5 else "#fdf0f0"
        input_text = str(r.get("input", ""))[:100]
        expected = str(r.get("expected", ""))[:80]
        predicted = str(r.get("predicted", ""))[:80]
        rows += f'''
        <tr style="background:{bg}">
            <td style="padding:6px; border-bottom:1px solid #edebe9">{i+1}</td>
            <td style="padding:6px; border-bottom:1px solid #edebe9">{icon}</td>
            <td style="padding:6px; border-bottom:1px solid #edebe9; font-size:0.85em">{_escape_html(input_text)}</td>
            <td style="padding:6px; border-bottom:1px solid #edebe9; font-size:0.85em">{_escape_html(expected)}</td>
            <td style="padding:6px; border-bottom:1px solid #edebe9; font-size:0.85em">{_escape_html(predicted)}</td>
            <td style="padding:6px; border-bottom:1px solid #edebe9; font-weight:bold">{score:.0%}</td>
        </tr>'''
    
    html = f'''
    <table style="border-collapse:collapse; width:100%; margin:12px 0">
        <thead>
            <tr style="background:#f3f2f1">
                <th style="padding:8px; text-align:left; border-bottom:2px solid #8a8886">#</th>
                <th style="padding:8px; text-align:left; border-bottom:2px solid #8a8886"></th>
                <th style="padding:8px; text-align:left; border-bottom:2px solid #8a8886">Input</th>
                <th style="padding:8px; text-align:left; border-bottom:2px solid #8a8886">Expected</th>
                <th style="padding:8px; text-align:left; border-bottom:2px solid #8a8886">Predicted</th>
                <th style="padding:8px; text-align:left; border-bottom:2px solid #8a8886">Score</th>
            </tr>
        </thead>
        <tbody>{rows}</tbody>
    </table>
    '''
    if len(results) > max_rows:
        html += f'<p style="color:#605e5c">Showing {max_rows} of {len(results)} results</p>'
    display(HTML(html))


# ============================================================================
# TEACHING INSIGHT CARDS
# ============================================================================

def display_insight(title: str, message: str, icon: str = "💡"):
    """Display a teaching insight card."""
    display(HTML(f'''
    <div style="background:linear-gradient(135deg, #f0f6ff, #e8f0fe); 
                border-left:4px solid #0078d4; padding:16px; margin:12px 0; 
                border-radius:0 8px 8px 0">
        <div style="font-size:1.1em; font-weight:bold; color:#0078d4; margin-bottom:4px">
            {icon} {_escape_html(title)}
        </div>
        <div style="color:#323130">{_escape_html(message)}</div>
    </div>
    '''))

def display_tier_header(tier: int, title: str, description: str):
    """Display a tier section header."""
    stars = "★" * tier + "☆" * (4 - tier)
    display(HTML(f'''
    <div style="background:#f3f2f1; padding:16px; margin:20px 0 12px 0; border-radius:8px">
        <h2 style="margin:0; color:#323130">Tier {tier}: {_escape_html(title)} 
            <span style="font-size:0.7em; color:#ca5010">{stars}</span>
        </h2>
        <p style="color:#605e5c; margin:4px 0 0 0">{_escape_html(description)}</p>
    </div>
    '''))


# ============================================================================
# PLOTLY CHARTS
# ============================================================================

def bar_comparison(task_name: str, model_scores: dict[str, dict]) -> go.Figure:
    """Create a grouped bar chart comparing models (baseline vs optimized).
    
    model_scores: {"gpt-4o": {"baseline": 0.72, "optimized": 0.91}, ...}
    """
    models = list(model_scores.keys())
    baselines = [model_scores[m].get("baseline", 0) for m in models]
    optimized = [model_scores[m].get("optimized", 0) for m in models]
    
    fig = go.Figure()
    fig.add_trace(go.Bar(
        name="Baseline (zero-shot)",
        x=models, y=[s * 100 for s in baselines],
        marker_color="#a4a4a4", text=[f"{s:.0%}" for s in baselines],
        textposition="outside",
    ))
    fig.add_trace(go.Bar(
        name="After DSPy Optimization",
        x=models, y=[s * 100 for s in optimized],
        marker_color="#0078d4", text=[f"{s:.0%}" for s in optimized],
        textposition="outside",
    ))
    
    fig.update_layout(
        title=f"Model Comparison: {task_name}",
        yaxis_title="Score (%)", yaxis_range=[0, 110],
        barmode="group",
        template="plotly_white",
        height=400,
    )
    return fig

def line_progress(trial_scores: list[float], title: str = "Optimization Progress") -> go.Figure:
    """Create a line chart showing optimization progress over trials."""
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=list(range(1, len(trial_scores) + 1)),
        y=[s * 100 for s in trial_scores],
        mode="lines+markers",
        marker_color="#0078d4",
        name="Trial Score",
    ))
    
    # Add best-so-far line
    best_so_far = []
    best = 0
    for s in trial_scores:
        best = max(best, s)
        best_so_far.append(best)
    fig.add_trace(go.Scatter(
        x=list(range(1, len(trial_scores) + 1)),
        y=[s * 100 for s in best_so_far],
        mode="lines",
        line=dict(dash="dash", color="#107c10"),
        name="Best So Far",
    ))
    
    fig.update_layout(
        title=title,
        xaxis_title="Trial", yaxis_title="Score (%)",
        yaxis_range=[0, 105],
        template="plotly_white",
        height=350,
    )
    return fig

def heatmap_tasks_models(
    task_names: list[str],
    model_names: list[str],
    scores: list[list[float]],
    title: str = "Task × Model Performance Matrix"
) -> go.Figure:
    """Create a heatmap of tasks vs models.
    
    scores[i][j] = score for task_names[i] on model_names[j]
    """
    fig = go.Figure(data=go.Heatmap(
        z=[[s * 100 for s in row] for row in scores],
        x=model_names,
        y=task_names,
        colorscale="RdYlGn",
        zmin=0, zmax=100,
        text=[[f"{s:.0%}" for s in row] for row in scores],
        texttemplate="%{text}",
        textfont={"size": 10},
        colorbar_title="Score %",
    ))
    
    fig.update_layout(
        title=title,
        template="plotly_white",
        height=max(300, len(task_names) * 35 + 100),
        yaxis=dict(autorange="reversed"),
    )
    return fig

def cost_roi_chart(
    optimization_calls: int,
    cost_per_call: float,
    baseline_accuracy: float,
    optimized_accuracy: float,
    queries: int = 10000,
    cost_per_query: float = 0.002,
) -> go.Figure:
    """Create a cost/ROI comparison chart."""
    opt_cost = optimization_calls * cost_per_call
    baseline_correct = int(queries * baseline_accuracy)
    optimized_correct = int(queries * optimized_accuracy)
    total_query_cost = queries * cost_per_query
    
    fig = go.Figure()
    fig.add_trace(go.Bar(
        name="Correct Answers",
        x=["Baseline", "Optimized"],
        y=[baseline_correct, optimized_correct],
        marker_color=["#a4a4a4", "#0078d4"],
        text=[f"{baseline_correct:,}", f"{optimized_correct:,}"],
        textposition="outside",
    ))
    
    fig.update_layout(
        title=f"ROI: +{optimized_correct - baseline_correct:,} correct answers for ${opt_cost:.2f} optimization cost",
        yaxis_title=f"Correct out of {queries:,} queries",
        template="plotly_white",
        height=350,
        annotations=[dict(
            text=f"Total query cost: ${total_query_cost:.2f} | Optimization cost: ${opt_cost:.2f}",
            xref="paper", yref="paper", x=0.5, y=-0.15,
            showarrow=False, font=dict(size=11, color="#605e5c"),
        )]
    )
    return fig
