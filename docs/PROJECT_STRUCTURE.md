# Project Structure

Complete overview of all files and directories in this project.

```
python-quart-vite-react/
│
├── backend/                      # Python Quart Backend
│   ├── app.py                   # REST API endpoints (uses tasks.service)
│   ├── mcp_server.py            # MCP server (uses tasks.service)
│   ├── tasks/                   # Reusable task management module
│   │   ├── __init__.py         # Module initialization
│   │   └── service.py          # Core business logic (deep module)
│   └── requirements.txt         # Python dependencies
│
├── frontend/                     # React Frontend
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   └── About.jsx        # About page component
│   │   │
│   │   ├── features/            # Feature modules
│   │   │   ├── dashboard/       # Dashboard feature
│   │   │   │   └── Dashboard.jsx    # Real-time server info
│   │   │   │
│   │   │   └── tasks/           # Task management feature
│   │   │       ├── TaskList.jsx     # Task list with CRUD
│   │   │       └── TaskDialog.jsx   # Create/edit dialog
│   │   │
│   │   ├── services/            # API and service layer
│   │   │   └── api.js           # Backend API client
│   │   │
│   │   ├── App.jsx              # Main application component
│   │   ├── main.jsx             # React entry point
│   │   └── index.css            # Global styles
│   │
│   ├── index.html               # HTML entry point
│   ├── package.json             # Node.js dependencies
│   ├── vite.config.js           # Vite configuration
│   └── node_modules/            # Installed packages (created during setup)
│
├── tests/
│   └── e2e/                     # End-to-end tests
│       └── app.spec.js          # Playwright test suite
│
├── .vscode/                      # VSCode configuration
│   ├── launch.json              # Debug configurations
│   ├── settings.json            # Workspace settings
│   └── extensions.json          # Recommended extensions
│
├── .venv/                      # Top-level Python virtual environment (gitignored)
├── .gitignore                   # Git ignore rules
├── package.json                 # Root package.json for Playwright
├── playwright.config.js         # Playwright configuration
│
├── setup.sh                     # Automated setup script
├── start-dev.sh                 # Development server launcher
│
├── docs/                       # Supplemental documentation
│   ├── LEARNING.md             # Learning guide and principles
│   ├── PROJECT_STRUCTURE.md    # This file
│   ├── PYDANTIC_ARCHITECTURE.md # Deep dive into Pydantic models
│   ├── QUICKSTART.md           # Quick start guide
│   ├── TROUBLESHOOTING.md      # Common issues and fixes
│   └── UNIFIED_ARCHITECTURE.md # REST + MCP architecture guide
└── README.md                   # Main documentation
```

## File Purposes

### Backend Files

| File | Purpose |
|------|---------|
| `backend/app.py` | REST API endpoints using tasks.service module |
| `backend/mcp_server.py` | MCP server using tasks.service module |
| `backend/tasks/service.py` | Core business logic - deep module with simple interface |
| `backend/tasks/__init__.py` | Module initialization file |
| `backend/requirements.txt` | Python package dependencies (Quart, MCP, etc.) |
| `.venv/` | Repo-level Python virtual environment (gitignored) |

### Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/main.jsx` | React application entry point, sets up FluentUI theme |
| `frontend/src/App.jsx` | Main app component with tab navigation |
| `frontend/src/index.css` | Global CSS styles |
| `frontend/src/services/api.js` | API client for backend communication |
| `frontend/src/components/About.jsx` | About page with project info |
| `frontend/src/features/dashboard/Dashboard.jsx` | Real-time dashboard with SSE |
| `frontend/src/features/tasks/TaskList.jsx` | Task list with filtering and actions |
| `frontend/src/features/tasks/TaskDialog.jsx` | Task create/edit modal dialog |
| `frontend/index.html` | HTML template |
| `frontend/vite.config.js` | Vite build tool configuration |
| `frontend/package.json` | Frontend dependencies |

### Test Files

| File | Purpose |
|------|---------|
| `tests/e2e/app.spec.js` | End-to-end test suite using Playwright |
| `playwright.config.js` | Playwright test runner configuration |

### Configuration Files

| File | Purpose |
|------|---------|
| `.vscode/launch.json` | VSCode debug configurations for backend and frontend |
| `.vscode/settings.json` | Workspace settings (Python, formatting, etc.) |
| `.vscode/extensions.json` | Recommended VSCode extensions |
| `.gitignore` | Files to exclude from git |
| `package.json` | Root package.json for running E2E tests |

### Documentation

| File | Purpose |
|------|---------|
| `../README.md` | Complete documentation with setup instructions |
| `QUICKSTART.md` | Fast setup guide for quick start |
| `LEARNING.md` | Explains code principles and patterns |
| `PROJECT_STRUCTURE.md` | This file - project organization |
| `PYDANTIC_ARCHITECTURE.md` | Deep dive into Pydantic models and validation |
| `UNIFIED_ARCHITECTURE.md` | Unified REST + MCP architecture reference |
| `TROUBLESHOOTING.md` | Common setup, dev, and test fixes |

### Scripts

| File | Purpose |
|------|---------|
| `setup.sh` | Automated setup for both backend and frontend |
| `start-dev.sh` | Starts both servers simultaneously |

## Key Directories Explained

### `/backend`
Contains the Python backend with multiple interfaces sharing the same business logic.

**Architecture Pattern - Deep Modules:**
- `tasks/service.py` - Core business logic (calculations, actions, data)
- `app.py` - REST API interface (uses tasks.service)
- `mcp_server.py` - MCP interface (uses tasks.service)

**Main responsibilities:**
- Serve API endpoints (`/api/*`)
- Handle Server-Sent Events for real-time updates
- Manage task data (in-memory for demo)
- Demonstrate code reusability across different interfaces

**Key Benefit:** Business logic is written once in `tasks.service` and reused by both REST API and MCP server. Adding a new interface (CLI, GraphQL, etc.) requires zero changes to business logic!

### `/frontend/src/features`
Feature-based organization. Each feature is self-contained:

- **dashboard/**: Server time and date display
- **tasks/**: Complete task management system

This structure scales well - adding a new feature means adding a new folder.

### `/frontend/src/services`
Shared services used across features:

- **api.js**: All backend communication
- Future: auth.js, storage.js, etc.

### `/frontend/src/components`
Reusable components shared across multiple features.

### `/tests/e2e`
End-to-end tests that verify the entire application works correctly from a user's perspective.

### `/.vscode`
VSCode-specific configuration for a better development experience:

- Debug configurations
- Recommended extensions
- Editor settings

## Adding New Features

When adding a new feature, follow this structure:

**Backend (modular approach):**
```
backend/my-feature/
├── __init__.py           # Module initialization
└── service.py            # Business logic (calculations, actions, data)
```

**Frontend:**
```
frontend/src/features/my-feature/
├── MyFeature.jsx          # Main component
├── MyFeatureDialog.jsx    # Related dialog/modal
└── my-feature.css         # Feature-specific styles (optional)
```

Then:
1. Create business logic in `backend/my-feature/service.py`
2. Add REST API endpoints in `backend/app.py` that use `my-feature.service`
3. (Optional) Add MCP tools in `backend/mcp_server.py` that use `my-feature.service`
4. Add API client functions in `frontend/src/services/api.js`
5. Import and use in `frontend/src/App.jsx`
6. Add tests in `tests/e2e/`

**Key Principle:** Keep business logic separate from interface concerns. This allows the same code to be used by REST API, MCP, CLI, or any other interface!

## Development Workflow

```mermaid
graph LR
    A[Edit Code] --> B[Auto-reload]
    B --> C[Test in Browser]
    C --> D[Debug if needed]
    D --> A
    C --> E[Write E2E Test]
    E --> F[Run Tests]
```

1. Edit backend or frontend code
2. Both servers auto-reload (hot reload)
3. Test changes in browser
4. Use VSCode debugger if needed
5. Write/update E2E tests
6. Run full test suite

## File Size Guidelines

This project is intentionally kept small and focused:

- Each component: < 200 lines
- Each function: < 30 lines
- Total backend: ~300 lines
- Total frontend: ~500 lines

If a file grows beyond these guidelines, consider splitting it into smaller modules.

## Questions?

Refer to:
- [README.md](../README.md) for setup and running
- [QUICKSTART.md](QUICKSTART.md) for fast setup
- [LEARNING.md](LEARNING.md) for understanding the code principles
