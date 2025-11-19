# Troubleshooting Guide

Common issues and solutions when working with the Quart + React demo app.

## Table of Contents

- [Setup Issues](#setup-issues)
- [Backend Issues](#backend-issues)
- [Frontend Issues](#frontend-issues)
- [Debugging Tips](#debugging-tips)
- [Testing Issues](#testing-issues)

## Setup Issues

### Python Not Found

**Problem:**
```bash
bash: python3: command not found
```

**Solution:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install python3 python3-pip python3-venv

# Verify installation
python3 --version
```

### Node.js Not Found

**Problem:**
```bash
bash: node: command not found
```

**Solution:**
```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### Virtual Environment Won't Activate

**Problem:**
```bash
source .venv/bin/activate  # Does nothing
```

**Solution:**
```bash
# Run these commands from the repo root

# Remove old .venv if it exists
rm -rf .venv

# Create new virtual environment at the top level
python3 -m venv .venv

# Activate it
source .venv/bin/activate

# You should see (.venv) in your prompt

# Install backend dependencies
pip install -r backend/requirements.txt
```

### Permission Denied on Scripts

**Problem:**
```bash
bash: ./setup.sh: Permission denied
```

**Solution:**
```bash
# Make scripts executable
chmod +x setup.sh start-dev.sh

# Now run them
./setup.sh
```

## Backend Issues

### Port Already in Use

**Important:** This project uses port 5001 for the backend (not 5000) because on macOS Monterey and later, port 5000 is used by AirPlay Receiver.

**Problem:**
```
Error: Address already in use
```

**Solution:**
```bash
# Find process using port 5001
sudo lsof -i :5001

# Kill the process (replace PID with actual process ID)
sudo kill -9 <PID>
```

**macOS AirPlay Issue:**
If you see port 5000 conflicts on macOS:
- Go to System Preferences → Sharing
- Uncheck "AirPlay Receiver"
- Or use a different port (we've already changed to 5001)

### Module Not Found Error

**Problem:**
```python
ModuleNotFoundError: No module named 'quart'
```

**Solution:**
```bash
# Make sure virtual environment is activated
source .venv/bin/activate

# You should see (.venv) in your prompt

# Reinstall dependencies
pip install -r backend/requirements.txt

# If still having issues
pip install --upgrade pip
pip install -r backend/requirements.txt --force-reinstall
```

### CORS Errors

**Problem:**
```
Access to fetch at 'http://localhost:5001/api/tasks' from origin
'http://localhost:3001' has been blocked by CORS policy
```

**Solution:**
This should already be handled by `quart-cors` in the backend, but if you see this:

```bash
# Make sure quart-cors is installed
source .venv/bin/activate
cd backend
pip install quart-cors

# Verify it's in requirements.txt
cat requirements.txt
```

### Backend Crashes on Startup

**Problem:**
```
Traceback (most recent call last):
  File "app.py", line X
```

**Solution:**
```bash
# Check Python version (needs 3.10+)
python3 --version

# Make sure you're in the right directory
cd backend

# Make sure virtual environment is activated
source ../.venv/bin/activate

# Try running with more verbose output
python app.py
```

## Frontend Issues

### Port 3001 Already in Use

**Problem:**
```
Port 3001 is in use, trying another port...
```

**Solution:**
```bash
# Option 1: Kill the process using port 3001
sudo lsof -i :3001
sudo kill -9 <PID>

# Option 2: Update vite.config.js to another open port (e.g., 3002)
# server: { port: 3002 }
```

### npm install Fails

**Problem:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solution:**
```bash
cd frontend

# Clear npm cache
npm cache clean --force

# Remove old files
rm -rf node_modules package-lock.json

# Try installing with legacy peer deps
npm install --legacy-peer-deps

# Or force install
npm install --force
```

### Module Not Found in Frontend

**Problem:**
```
Failed to resolve import "@fluentui/react-components"
```

**Solution:**
```bash
cd frontend

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# If specific package is missing
npm install @fluentui/react-components
```

### Vite Build Fails

**Problem:**
```
error during build:
Error: Build failed with X errors
```

**Solution:**
```bash
# Clear Vite cache
rm -rf frontend/node_modules/.vite

# Restart dev server
cd frontend
npm run dev
```

### White Screen / Nothing Renders

**Problem:**
Browser shows blank page, no errors in terminal.

**Solution:**
```bash
# Check browser console (F12)
# Look for JavaScript errors

# Common causes:
# 1. Backend not running
source .venv/bin/activate
cd backend
python app.py

# 2. Check API proxy in vite.config.js
# Should have:
# proxy: {
#   '/api': {
#     target: 'http://localhost:5001',
#     changeOrigin: true,
#   }
# }
```

## Debugging Tips

### Backend Debugging

**Enable verbose logging:**
```python
# In backend/app.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

**Print debugging:**
```python
# Add print statements
print(f"Tasks: {tasks_db}")
print(f"Received data: {data}")
```

**Use VSCode debugger:**
1. Open VSCode
2. Set breakpoint in `backend/app.py`
3. Press F5
4. Select "Python: Quart Backend"
5. Interact with app
6. Execution stops at breakpoint

### Frontend Debugging

**Browser DevTools:**
```bash
# Open browser console: F12 or Ctrl+Shift+I

# Check tabs:
# - Console: JavaScript errors
# - Network: API calls and responses
# - Elements: Inspect DOM
# - React DevTools: Component state (install extension)
```

**Console logging:**
```javascript
// Add to component
console.log('Tasks:', tasks)
console.log('State:', { filter, loading, error })
```

**React DevTools:**
```bash
# Install React DevTools browser extension
# Then in browser:
# F12 → Components tab → Click component → See props/state
```

**VSCode debugging:**
1. Start frontend: `npm run dev`
2. Press F5 in VSCode
3. Select "Chrome: React Frontend"
4. Set breakpoints in `.jsx` files
5. Interact with app in opened browser

### Network Issues

**Check API calls:**
```bash
# In browser DevTools → Network tab:
# 1. Reload page
# 2. Filter by XHR/Fetch
# 3. Click on request
# 4. Check:
#    - Request URL
#    - Status code
#    - Request payload
#    - Response data
```

**Test API directly:**
```bash
# Test backend endpoints with curl
curl http://localhost:5001/api/health
curl http://localhost:5001/api/date
curl http://localhost:5001/api/tasks

# Create a task
curl -X POST http://localhost:5001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Test task","description":"Testing"}'
```

## Testing Issues

### Playwright Installation Fails

**Problem:**
```
Failed to install browsers
```

**Solution:**
```bash
# Install system dependencies first
sudo npx playwright install-deps

# Then install browsers
npx playwright install

# If on Ubuntu and having issues:
sudo apt-get update
sudo apt-get install -y \
  libnss3 \
  libnspr4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libdbus-1-3 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libpango-1.0-0 \
  libcairo2 \
  libasound2
```

### Tests Fail with "Connection Refused"

**Problem:**
```
Error: connect ECONNREFUSED 127.0.0.1:3001
```

**Solution:**
```bash
# Make sure both servers are running

# Terminal 1
source .venv/bin/activate
cd backend
python app.py

# Terminal 2
cd frontend
npm run dev

# Terminal 3 (wait for both to start)
npm run test:e2e
```

### Tests Timeout

**Problem:**
```
Test timeout of 30000ms exceeded
```

**Solution:**
```bash
# Increase timeout in playwright.config.js
# Add to config:
# timeout: 60000,  // 60 seconds

# Or in specific test:
test('my test', async ({ page }) => {
  // ...
}, { timeout: 60000 })
```

## Still Having Issues?

### Check the Basics

1. **Are you in the right directory?**
   ```bash
   pwd  # Should show path ending in /python-quart-vite-react
   ```

2. **Is the virtual environment activated?** (for backend work)
  ```bash
  # Should see (.venv) in your prompt
  ```

3. **Are both servers running?**
   ```bash
   # Backend should show:
   # * Running on http://0.0.0.0:5001

   # Frontend should show:
   # VITE v5.x.x  ready in XXX ms
  # ➜  Local:   http://localhost:3001/
   ```

4. **Check browser console for errors** (F12)

5. **Check terminal output for errors**

### Get More Help

1. Read the full [README.md](../README.md)
2. Check [LEARNING.md](LEARNING.md) for code explanations
3. Review [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for file locations

### Clean Slate Approach

If all else fails, start fresh:

```bash
# Backend
rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install

# Root (for Playwright)
cd ..
rm -rf node_modules package-lock.json
npm install
npx playwright install
```

Then try running again:
```bash
./start-dev.sh
```

## Tips for Preventing Issues

1. **Always activate virtual environment** when working with backend
2. **Keep dependencies updated** periodically
3. **Check terminal output** for warnings
4. **Use VSCode debugger** instead of print statements
5. **Test one change at a time** to isolate issues
6. **Read error messages carefully** - they usually tell you what's wrong!

Happy debugging! 🐛🔧
