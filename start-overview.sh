#!/bin/bash

# Start Ticket Overview Console on port 8000
# This is a standalone application

cd "$(dirname "$0")/overview-console"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start the dev server
npm run dev
