#!/bin/bash

# Qirata Express Backend Setup Script
# =================================
# This script automates the setup process for the Qirata Express backend.
# It handles dependency installation, environment configuration, database setup,
# and initial build process. The script includes error checking and prerequisite
# verification to ensure a smooth setup experience.
#
# Features:
# - Dependency installation
# - Environment configuration
# - Database creation and migration
# - TypeScript build
# - Test execution
# - Automatic JWT secret generation

# Exit on error
set -e

echo "Starting Qirata Express Backend Setup..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed. Aborting." >&2; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "PostgreSQL is required but not installed. Aborting." >&2; exit 1; }

# Install dependencies
echo "Installing dependencies..."
npm install

# Setup environment
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env

    # Generate random JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i '' "s/your_jwt_secret/$JWT_SECRET/" .env

    echo "Environment file created with secure JWT secret"
fi

# Database setup
echo "Setting up database..."
DB_NAME=$(grep DB_NAME .env | cut -d '=' -f2)
DB_USER=$(grep DB_USER .env | cut -d '=' -f2)

# Create database if not exists
psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME || {
    echo "Creating database $DB_NAME..."
    createdb $DB_NAME
}

# Run migrations
echo "Running database migrations..."
npm run migration:run

# Build TypeScript
echo "Building TypeScript..."
npm run build

# Run tests
echo "Running tests..."
npm test

echo "✨ Setup complete! ✨"
echo "
Next steps:
1. Review the .env file and update any necessary configurations
2. Start the development server: npm run dev
3. Check the API documentation at /docs/API.md
"