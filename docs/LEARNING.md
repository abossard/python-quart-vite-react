# Learning Guide

This document explains the coding principles and patterns used in this project. It's designed to help you understand not just *what* the code does, but *why* it's structured this way.

## Table of Contents

1. [Core Principles](#core-principles)
2. [Backend Architecture](#backend-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [Testing Strategy](#testing-strategy)
5. [Learning Exercises](#learning-exercises)

## Core Principles

### Grokking Simplicity

This book teaches us to separate our code into three categories:

#### 1. Actions (I/O - Impure)

Functions that interact with the outside world (databases, networks, files, time).

**Backend Example:**

```python
# ACTION - Reads from database
def get_all_tasks() -> List[dict]:
    return list(tasks_db.values())

# ACTION - Writes to database
def save_task(task: dict) -> dict:
    tasks_db[task["id"]] = task
    return task
```

**Frontend Example:**

```javascript
// ACTION - Makes HTTP request
export async function getTasks(filter = 'all') {
  const params = filter !== 'all' ? `?filter=${filter}` : ''
  return fetchJSON(`${API_BASE_URL}/tasks${params}`)
}
```

#### 2. Calculations (Pure Functions)

Functions that transform data without side effects. Same input = same output.

**Backend Example:**

```python
# CALCULATION - Pure function
def format_datetime(dt: datetime) -> str:
    return dt.isoformat()

# CALCULATION - Creates data without mutation
def create_task_data(title: str, description: str = "") -> dict:
    return {
        "id": str(uuid.uuid4()),
        "title": title,
        "description": description,
        "completed": False,
        "created_at": format_datetime(datetime.now())
    }
```

**Frontend Example:**

```javascript
// CALCULATION - Pure function
function formatDate(isoString) {
  const date = new Date(isoString)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

// CALCULATION - Pure transformation
function getTaskStats(tasks) {
  return {
    total: tasks.length,
    completed: tasks.filter((t) => t.completed).length,
    pending: tasks.filter((t) => !t.completed).length,
  }
}
```

#### 3. Data (Immutable Structures)

Plain data structures that don't do anything.

```python
# Python - Dictionary (we keep this immutable by creating new objects)
task = {
    "id": "123",
    "title": "Learn Quart",
    "completed": False
}
```

```javascript
// JavaScript - Plain object
const task = {
  id: '123',
  title: 'Learn React',
  completed: false
}
```

**Why This Matters:**

- **Calculations** are easiest to test (no mocking needed)
- **Actions** are isolated, making bugs easier to find
- **Data** is predictable and safe to share

### A Philosophy of Software Design

#### Deep Modules

A module should have a simple interface but handle complex functionality inside.

##### Example: API Service Module

```javascript
// Simple interface
export async function createTask(taskData)

// Complex implementation hidden inside
async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}
```

Users of `createTask` don't need to know about error handling, headers, or JSON parsing.

#### Information Hiding

Hide implementation details behind clean interfaces.

**Backend Example:**

```python
# Public interface - simple
@app.route("/api/tasks", methods=["POST"])
async def create_task():
    data = await request.get_json()
    new_task = create_task_data(data["title"], data.get("description", ""))
    saved_task = save_task(new_task)
    return jsonify(saved_task), 201

# Private details - hidden
def create_task_data(title: str, description: str = "") -> dict:
    # Implementation details hidden from API consumers
    return {...}
```

#### Clear Module Boundaries

Organize code by feature, not by technical layer.

```ascii
frontend/src/
├── features/
│   ├── dashboard/     # Everything for dashboard feature
│   │   └── Dashboard.jsx
│   └── tasks/         # Everything for task feature
│       ├── TaskList.jsx
│       └── TaskDialog.jsx
└── services/          # Shared services
    └── api.js
```

## Backend Architecture

### File Structure

```python
# DATA LAYER - Pure data structures
tasks_db: Dict[str, dict] = {}

# CALCULATIONS - Pure functions
def format_datetime(dt: datetime) -> str:
    return dt.isoformat()

# ACTIONS - I/O operations
def save_task(task: dict) -> dict:
    tasks_db[task["id"]] = task
    return task

# ROUTE HANDLERS - Orchestrate actions and calculations
@app.route("/api/tasks", methods=["POST"])
async def create_task():
    data = await request.get_json()
    new_task = create_task_data(data["title"])  # Calculation
    saved_task = save_task(new_task)            # Action
    return jsonify(saved_task), 201
```

### Server-Sent Events (SSE)

Real-time updates without WebSockets!

```python
@app.route("/api/time-stream", methods=["GET"])
async def time_stream():
    async def generate_time_events():
        while True:
            now = datetime.now()
            time_data = {"time": now.strftime("%H:%M:%S")}
            yield f"data: {jsonify(time_data).get_data(as_text=True)}\n\n"
            await asyncio.sleep(1)

    return generate_time_events(), {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache"
    }
```

**Frontend consumption:**

```javascript
export function connectToTimeStream(onMessage, onError) {
  const eventSource = new EventSource(`${API_BASE_URL}/time-stream`)

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data)
    onMessage(data)
  }

  return () => eventSource.close()  // Cleanup function
}
```

## Frontend Architecture

### Component Structure

Following the same principles:

```javascript
export default function TaskList() {
  // STATE (data)
  const [tasks, setTasks] = useState([])

  // CALCULATIONS (pure functions)
  const stats = getTaskStats(tasks)

  // ACTIONS (side effects)
  const loadTasks = async () => {
    const data = await getTasks()
    setTasks(data)
  }

  // EVENT HANDLERS (actions)
  const handleCreate = () => {
    setDialogOpen(true)
  }

  // RENDER (calculation - pure for given state)
  return <div>...</div>
}
```

### FluentUI Components

We use Microsoft's FluentUI for professional, accessible components:

```javascript
import {
  Button,
  Card,
  DataGrid,
  Dialog,
  // ... more components
} from '@fluentui/react-components'
```

**Key patterns:**

- Use `makeStyles` for styling
- Components are controlled (state-driven)
- Accessibility built-in

### State Management

Keep it simple with React hooks:

```javascript
// Local state for component data
const [tasks, setTasks] = useState([])

// Effects for side effects
useEffect(() => {
  loadTasks()
}, [filter])  // Re-run when filter changes

// Cleanup in effects
useEffect(() => {
  const cleanup = connectToTimeStream(onMessage, onError)
  return cleanup  // Called when component unmounts
}, [])
```

## Testing Strategy

### E2E Tests with Playwright

Tests are written from the user's perspective:

```javascript
test('creates a new task like a boss', async ({ page }) => {
  // Navigate like a user would
  await page.getByTestId('create-task-button').click()

  // Fill in form
  await page.getByTestId('task-title-input').fill('New task')
  await page.getByTestId('save-button').click()

  // Verify result
  await expect(page.getByText('New task')).toBeVisible()
})
```

**Why E2E tests?**

- Test the full stack integration
- Catch issues users would encounter
- Serve as documentation of features

**Test Selectors:**

- Use `data-testid` for test-specific selectors
- Keeps tests independent of CSS/structure changes
- Makes intent clear

## Learning Exercises

Try these to deepen your understanding:

### Beginner

1. **Add a new field to tasks**
   - Add a "priority" field (low, medium, high)
   - Update both backend and frontend
   - Add it to the task dialog form

2. **Add a new API endpoint**
   - Create `/api/tasks/stats` that returns task statistics
   - Display it in the dashboard

3. **Style customization**
   - Change the color theme
   - Modify card layouts
   - Customize button styles

4. **Add sorting to task list**
   - Sort by creation date
   - Sort by title
   - Sort by completion status

5. **Add task search**
   - Filter tasks by title
   - Implement debounced search
   - Keep search in URL query params

6. **Add animations**
   - Animate task list changes
   - Add loading states
   - Smooth transitions between tabs

7. **Add persistence**
   - Replace in-memory storage with SQLite
   - Add database migrations
   - Handle concurrent updates

8. **Add authentication**
   - User registration and login
   - JWT tokens
   - Protected routes

9. **Add WebSockets**
   - Real-time task updates across clients
   - Collaborative editing
   - Online user presence

## Code Review Checklist

When writing new code, ask yourself:

- [ ] Is this function a calculation, action, or data?
- [ ] Are calculations pure (no side effects)?
- [ ] Are actions clearly separated and isolated?
- [ ] Does this module hide its complexity?
- [ ] Is the interface simple and clear?
- [ ] Would a new developer understand this?
- [ ] Are there comments explaining *why*, not *what*?
- [ ] Does this follow the existing patterns?

## Resources

- **Grokking Simplicity** by Eric Normand
- **A Philosophy of Software Design** by John Ousterhout
- [Clean Code principles](https://www.freecodecamp.org/news/clean-coding-for-beginners/)
- [React best practices](https://react.dev/learn/thinking-in-react)

## Questions?

As you explore the code, ask yourself:

1. Why is this a separate function?
2. Where would I add a new feature?
3. How would I test this?
4. What would break if I changed this?
5. Is there a simpler way to do this?

Happy learning! 🎓
