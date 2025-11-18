# Quart + Vite + React Demo Application

A modern, educational full-stack web application demonstrating best practices in software development. This project combines a Python Quart async backend with a React frontend using Microsoft's FluentUI component library.

## Features

- **Python Quart Backend**: Async web framework with RESTful API and Server-Sent Events
- **React 18 Frontend**: Modern UI built with Vite and FluentUI components
- **Real-time Updates**: Server-Sent Events (SSE) for live time streaming
- **CRUD Operations**: Complete task management with create, read, update, delete
- **E2E Testing**: Playwright tests for comprehensive coverage
- **Clean Architecture**: Following principles from "Grokking Simplicity" and "A Philosophy of Software Design"

## Architecture

This project demonstrates **advanced software design** with **zero duplication**:

- **Single Process**: Both REST API and MCP server run in one process
- **Shared Metadata**: Operations defined once using decorators, exposed as both REST and MCP
- **Deep Modules**: Business logic (`tasks.service`) separate from interface concerns
- **No Code Duplication**: Metadata, routes, and schemas defined in one place

```
python-quart-vite-react/
├── backend/                  # Python Quart Backend
│   ├── app.py               # Unified server (REST + MCP JSON-RPC over HTTP)
│   ├── api_decorators.py    # Shared metadata system
│   ├── tasks/               # Reusable task management module
│   │   ├── __init__.py
│   │   └── service.py       # Core business logic (deep module)
│   └── requirements.txt     # Python dependencies
├── frontend/                # React application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── features/        # Feature-based modules
│   │   │   ├── dashboard/
│   │   │   └── tasks/
│   │   ├── services/        # API service layer
│   │   ├── App.jsx          # Main application component
│   │   └── main.jsx         # Application entry point
│   ├── package.json         # Node.js dependencies
│   └── vite.config.js       # Vite configuration
├── tests/
│   └── e2e/                 # Playwright E2E tests
└── .vscode/                 # VSCode configuration
```

### Advanced Backend Architecture

The backend showcases **cutting-edge design patterns**:

#### 1. Unified Operation System ([api_decorators.py](backend/api_decorators.py))
Define an operation once, expose it everywhere:

```python
@operation(
    name="create_task",
    description="Create a new task",
    parameters=[
        Parameter("title", "string", "Task title", required=True),
        Parameter("description", "string", "Task description")
    ],
    http_method="POST",
    http_path="/api/tasks"
)
async def op_create_task(title: str, description: str = ""):
    return tasks_service.create_task(title, description)
```

This single decorator:

- ✅ Generates REST endpoint: `POST /api/tasks`
- ✅ Generates MCP tool: `create_task`
- ✅ Defines schemas for both automatically
- ✅ **Zero duplication** of metadata!

#### 2. Deep Module Design ([tasks/service.py](backend/tasks/service.py))

- Simple interface, complex implementation
- Pure functions (calculations) + I/O functions (actions)
- Used by all interfaces without modification

#### 3. Single Process, Multiple Interfaces ([app.py](backend/app.py))

- REST API: `http://localhost:5001/api/*`
- MCP JSON-RPC: `http://localhost:5001/mcp`
- Same data, same logic, different protocols
- No inter-process communication needed

**Example**: Create a task via MCP, see it via REST immediately!

## Prerequisites

### Ubuntu/Linux Setup

1. **Python 3.10+**
   ```bash
   # Check Python version
   python3 --version

   # If you need to install Python 3.10+
   sudo apt update
   sudo apt install python3 python3-pip python3-venv
   ```

2. **Node.js 18+**
   ```bash
   # Install Node.js using NodeSource
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs

   # Verify installation
   node --version
   npm --version
   ```

3. **Git** (if cloning from repository)
   ```bash
   sudo apt install git
   ```

## Installation & Setup

### Step 1: Clone or Download the Project

```bash
# If using git
git clone <repository-url>
cd python-quart-vite-react

# Or if you have the project folder
cd python-quart-vite-react
```

### Step 2: Set Up Python Backend

```bash
# Navigate to backend directory
cd backend

# Create a virtual environment
python3 -m venv venv

# Activate the virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# The prompt should now show (venv) indicating the virtual environment is active
```

### Step 3: Set Up React Frontend

```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install dependencies
npm install

# This will download all required Node.js packages
```

### Step 4: Install Playwright (for E2E testing)

```bash
# In the project root directory
npm install
npx playwright install

# Install system dependencies for Playwright browsers
npx playwright install-deps
```

## Running the Application

You have several options to run the application:

### Option 1: Run Backend and Frontend Separately (Recommended for Development)

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate  # Activate virtual environment
python app.py
```

The backend will start on `http://localhost:5001`

> **Note:** We use port 5001 instead of 5000 because on macOS Monterey and later, port 5000 is used by AirPlay Receiver. To disable this in macOS: System Preferences → Sharing → uncheck "AirPlay Receiver".

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

The frontend will start on `http://localhost:3000`

**Access the Application:**
Open your browser and navigate to `http://localhost:3000`

### Option 2: Using VSCode (Easiest for Debugging)

1. Open the project in VSCode
2. Install recommended extensions (Python, Playwright, etc.)
3. Press `F5` or go to Run and Debug
4. Select "Full Stack: Backend + Frontend"
5. This will start both servers and attach debuggers

### Option 3: Production Build

```bash
# Build frontend for production
cd frontend
npm run build

# The built files will be in frontend/dist/
# You can serve these with any static file server
```

### Using the MCP Interface

The backend serves **both REST API and MCP in a single process**! This demonstrates:

- **Zero duplication**: Metadata defined once, exposed as both REST and MCP
- **Single process**: No need to run separate servers
- **Instant sync**: Changes via one interface immediately visible in the other

**MCP JSON-RPC Endpoint:**
```
POST http://localhost:5001/mcp
```

**Available MCP Tools** (auto-generated from @operation decorators):

- `create_task` - Create a new task
- `list_tasks` - List tasks with optional filtering (all/completed/pending)
- `get_task` - Get a specific task by ID
- `update_task` - Update task details
- `delete_task` - Delete a task
- `get_task_stats` - Get task statistics

**Testing MCP:**

```bash
# List available tools
curl -X POST http://localhost:5001/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}'

# Create a task via MCP
curl -X POST http://localhost:5001/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"create_task","arguments":{"title":"MCP Task","description":"Created via MCP"}},"id":2}'

# Verify it's visible via REST API
curl http://localhost:5001/api/tasks
```

**Key Architecture Benefit:** The same @operation decorator at [app.py:98](backend/app.py#L98) generates both the REST endpoint AND the MCP tool schema. Change it once, both interfaces update!

## Running Tests

### End-to-End Tests with Playwright

```bash
# Make sure both backend and frontend are running first

# Run all tests
npm run test:e2e

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Run specific test file
npx playwright test tests/e2e/app.spec.js
```

The Playwright configuration will automatically start the backend and frontend servers if they're not already running.

## Debugging in Visual Studio Code

### Debugging the Backend

1. Open the project in VSCode
2. Set breakpoints in `backend/app.py`
3. Press `F5` or go to "Run and Debug"
4. Select "Python: Quart Backend"
5. The debugger will stop at your breakpoints

### Debugging the Frontend

1. Make sure the frontend dev server is running (`npm run dev` in frontend/)
2. Set breakpoints in your React code (`.jsx` files)
3. Press `F5` or go to "Run and Debug"
4. Select "Chrome: React Frontend" or "Firefox: React Frontend"
5. A browser window will open with debugging enabled
6. The debugger will stop at your breakpoints

### Full Stack Debugging

1. Press `F5` and select "Full Stack: Backend + Frontend"
2. This will start both the backend and frontend with debuggers attached
3. You can now debug both simultaneously!

**Tips:**
- Set breakpoints by clicking in the gutter (left of line numbers)
- Use the Debug Console to evaluate expressions
- The Variables panel shows all local variables
- The Call Stack shows the execution path

## API Endpoints

### Health & Date
- `GET /api/health` - Health check endpoint
- `GET /api/date` - Get current server date and time
- `GET /api/time-stream` - Server-Sent Events stream for real-time time updates

### Task Management
- `GET /api/tasks` - List all tasks (supports `?filter=all|pending|completed`)
- `POST /api/tasks` - Create a new task
- `GET /api/tasks/:id` - Get a specific task
- `PUT /api/tasks/:id` - Update a task
- `DELETE /api/tasks/:id` - Delete a task

## Design Principles

This project demonstrates clean code principles from two influential books:

### Grokking Simplicity
- **Actions, Calculations, and Data**: Clear separation between I/O operations (actions), pure functions (calculations), and data structures
- **Immutability**: Data is kept immutable where possible
- **Explicit Side Effects**: Side effects are isolated and clearly marked

### A Philosophy of Software Design
- **Deep Modules**: Each module has a simple interface but handles complex functionality internally
- **Information Hiding**: Implementation details are hidden behind clean APIs
- **Strategic Programming**: Code is organized around features, not technical layers

## Project Structure Explained

### Backend (`backend/app.py`)

The backend is organized into clear sections:

1. **Data Layer**: Pure data structures (the `tasks_db` dictionary)
2. **Calculations**: Pure functions that transform data without side effects
3. **Actions**: Functions that perform I/O (database operations, API calls)
4. **Route Handlers**: API endpoints that coordinate actions and calculations

Example:
```python
# CALCULATION - Pure function
def format_datetime(dt: datetime) -> str:
    return dt.isoformat()

# ACTION - Function with I/O
def save_task(task: dict) -> dict:
    tasks_db[task["id"]] = task
    return task
```

### Frontend (`frontend/src/`)

The frontend follows a feature-based structure:

- **services/**: API communication layer (actions)
- **features/**: Self-contained feature modules
  - **dashboard/**: Real-time server information
  - **tasks/**: Task management with CRUD operations
- **components/**: Shared UI components

Each component separates:
- State management (React hooks)
- Pure functions for data transformation
- Event handlers for side effects

## Troubleshooting

### Backend Issues

**Port 5001 already in use:**

The backend uses port 5001 (not 5000) because macOS AirPlay uses port 5000.

```bash
# Find and kill the process using port 5001
sudo lsof -i :5001
sudo kill -9 <PID>
```

If you encounter port 5000 errors on macOS, disable AirPlay Receiver:
- System Preferences → Sharing → uncheck "AirPlay Receiver"

**Virtual environment not activating:**
```bash
# Make sure you're in the backend directory
cd backend

# Try activating again
source venv/bin/activate

# If that fails, recreate the virtual environment
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Frontend Issues

**Port 3000 already in use:**
```bash
# The error message will suggest an alternative port
# Or kill the process using port 3000
sudo lsof -i :3000
sudo kill -9 <PID>
```

**npm install fails:**
```bash
# Clear npm cache and try again
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Playwright Issues

**Browser installation fails:**
```bash
# Install system dependencies
sudo npx playwright install-deps

# Then reinstall browsers
npx playwright install
```

## Learning Resources

- [Quart Documentation](https://quart.palletsprojects.com/)
- [React Documentation](https://react.dev/)
- [FluentUI Documentation](https://react.fluentui.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Playwright Documentation](https://playwright.dev/)

## License

This is an educational project. Feel free to use it for learning and reference.

## Contributing

This is a demo project for educational purposes. Feel free to fork and modify it for your own learning!

## Questions?

If you're using this project to learn, here are some exercises to try:

1. Add a new field to tasks (e.g., priority, due date)
2. Implement task sorting and searching
3. Add user authentication
4. Create a new feature using the same patterns
5. Add more E2E tests
6. Implement data persistence (SQLite, PostgreSQL)

Happy coding!
