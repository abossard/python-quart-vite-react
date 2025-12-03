# Lesson 1: Modern Application Architecture

## Frontend

- has the UI components
- handles user interactions
- communicates with the backend via API clients (pieces of software that call the backend)

See also:
frontend folder

## Backend

- has the business logic and data models
- exposed via APIs (Application Programming Interfaces)

See also:
backend folder

## Data Models

- part of the backend
- represent the structure of data in the application
- represent what you can do with the data

See also:
backend/tasks.py

## Starting the whole application

- with ./start-dev.sh
- starts the backend on port 5001, also http://localhost:5001
- starts the frontend on port 3001, also http://localhost:3001

## MCP
- special API that is optimized for AI's to use
- when the backend is running, it can be accessed at http://localhost:5001/mcp
- a browser can't use it, but.... Github Copilot can!
- add the mcp to the mcp.json
    "tasks-mcp": {
      "url": "http://localhost:5001/mcp",
      "type": "http"
    }
- test it with copilot chat: 
    ask "list all tasks"
