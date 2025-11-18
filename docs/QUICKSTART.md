# Quick Start Guide

Want to get the app running in under 5 minutes? Follow this guide!

## Prerequisites

Make sure you have:
- Python 3.10+ installed (`python3 --version`)
- Node.js 18+ installed (`node --version`)

If not, install them:

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install python3 python3-pip python3-venv nodejs npm
```

## Option 1: Automated Setup (Easiest!)

```bash
# Run the setup script
./setup.sh

# Start both servers
./start-dev.sh
```

Open http://localhost:3001 in your browser!

## Option 2: Manual Setup (5 minutes)

### 1. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Keep this terminal running!

### 2. Frontend Setup (in a new terminal)

```bash
cd frontend
npm install
npm run dev
```

### 3. Open the App

Go to http://localhost:3001

## What You'll See

- **Dashboard Tab**: Real-time server clock using Server-Sent Events
- **Tasks Tab**: Full CRUD task management with FluentUI components
- **About Tab**: Information about the project and technologies

## Quick Test

Try creating a task:
1. Click "Tasks" tab
2. Click "New Task" button
3. Fill in the form
4. Watch it appear in the list!

## VSCode Debugging (Bonus)

1. Open the project in VSCode
2. Press `F5`
3. Select "Full Stack: Backend + Frontend"
4. Set breakpoints and debug both frontend and backend!

## Troubleshooting

**Port already in use?**
```bash
# Backend (port 5001 - we use 5001 because macOS AirPlay uses 5000)
sudo lsof -i :5001
sudo kill -9 <PID>

# Frontend (port 3001)
sudo lsof -i :3001
sudo kill -9 <PID>
```

**Dependencies not installing?**
```bash
# Python
cd backend
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Node.js
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

- Read the full [README.md](../README.md) for detailed documentation
- Run tests: `npm run test:e2e:ui`
- Explore the code and try modifying it!

Happy coding! 🚀
