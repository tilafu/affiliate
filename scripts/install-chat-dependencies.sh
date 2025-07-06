#!/bin/bash

# Script to install required dependencies for chat integration

echo "Installing required dependencies for chat integration..."

# Navigate to the server directory
cd "$(dirname "$0")/../server" || { echo "Error: Could not navigate to server directory"; exit 1; }

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed or not in PATH"
    exit 1
fi

# Install dependencies
echo "Installing express-session, socket.io, and cookie..."
npm install express-session socket.io cookie

if [ $? -eq 0 ]; then
    echo "Dependencies installed successfully!"
else
    echo "Error: Failed to install dependencies"
    echo "Please run the following commands manually:"
    echo "cd server"
    echo "npm install express-session socket.io cookie"
    exit 1
fi
