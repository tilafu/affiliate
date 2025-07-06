#!/bin/bash

# Script to update files for admin chat integration

# Set the base directory
BASE_DIR="$(dirname "$0")"
cd "$BASE_DIR"

# Install dependencies
echo "Installing required dependencies..."
bash ./scripts/install-chat-dependencies.sh

# Backup original files
echo "Creating backups of original files..."
mkdir -p ./backups
cp ./server/server.js ./backups/server.js.bak
cp ./server/routes/admin-chat-api-integrated.js ./backups/admin-chat-api-integrated.js.bak
cp ./server/chat-server.js ./backups/chat-server.js.bak

# Copy updated files
echo "Copying updated files..."
cp ./scripts/integration-updates/server.js ./server/server.js
cp ./scripts/integration-updates/admin-chat-api-integrated.js ./server/routes/admin-chat-api-integrated.js
cp ./scripts/integration-updates/chat-server.js ./server/chat-server.js

echo "Update completed successfully!"
echo "Please restart the server to apply changes."
