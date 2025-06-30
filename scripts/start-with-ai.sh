#!/bin/bash

echo "🚀 Starting Qirata with AI Chat Support"
echo "======================================="

# Function to check if a service is running
check_service() {
    local service_name="$1"
    local check_command="$2"

    echo -n "Checking $service_name... "
    if eval "$check_command"; then
        echo "✅ Running"
        return 0
    else
        echo "❌ Not running"
        return 1
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local service_name="$1"
    local check_command="$2"
    local max_attempts="${3:-30}"
    local attempt=1

    echo "Waiting for $service_name to be ready..."
    while [ $attempt -le $max_attempts ]; do
        if eval "$check_command" >/dev/null 2>&1; then
            echo "✅ $service_name is ready"
            return 0
        fi

        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo ""
    echo "❌ $service_name failed to start within $((max_attempts * 2)) seconds"
    return 1
}

# Check prerequisites
echo "📋 Checking Prerequisites"
echo "-------------------------"

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js is not installed"
    exit 1
fi
echo "✅ Node.js $(node --version)"

# Check npm
if ! command -v npm >/dev/null 2>&1; then
    echo "❌ npm is not installed"
    exit 1
fi
echo "✅ npm $(npm --version)"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Not in the Express backend directory"
    echo "Please run this script from express-backend/"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo ""

# Start or check Ollama
echo "🤖 AI Service Setup"
echo "-------------------"

if check_service "Ollama" "curl -s http://localhost:11434/api/version >/dev/null 2>&1"; then
    echo "✅ Ollama is already running"
else
    echo "Starting Ollama..."

    # Check if Ollama is installed
    if ! command -v ollama >/dev/null 2>&1; then
        echo "❌ Ollama is not installed"
        echo ""
        echo "To install Ollama:"
        echo "  curl -fsSL https://ollama.ai/install.sh | sh"
        echo ""
        echo "Or see: docs/OLLAMA_SETUP.md"
        echo ""
        echo "Starting without AI features..."
        AI_DISABLED=true
    else
        # Start Ollama in background
        nohup ollama serve >/dev/null 2>&1 &

        # Wait for Ollama to be ready
        if wait_for_service "Ollama" "curl -s http://localhost:11434/api/version >/dev/null 2>&1" 15; then
            echo "✅ Ollama started successfully"
        else
            echo "⚠️  Ollama failed to start, continuing without AI features"
            AI_DISABLED=true
        fi
    fi
fi

# Check Mistral model if Ollama is running
if [ "$AI_DISABLED" != "true" ]; then
    echo -n "Checking Mistral model... "
    if ollama list 2>/dev/null | grep -q "mistral"; then
        echo "✅ Available"
    else
        echo "❌ Not found"
        echo ""
        echo "Downloading Mistral model (this may take a few minutes)..."
        if ollama pull mistral; then
            echo "✅ Mistral model downloaded successfully"
        else
            echo "❌ Failed to download Mistral model"
            echo "⚠️  AI features will be limited"
        fi
    fi
fi

echo ""

# Database setup
echo "🗄️  Database Setup"
echo "------------------"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ .env file created. Please configure database settings."
    else
        echo "❌ .env.example not found"
        exit 1
    fi
fi

# Check database connection
echo -n "Checking database connection... "
if npm run typeorm schema:show >/dev/null 2>&1; then
    echo "✅ Connected"
else
    echo "❌ Failed"
    echo ""
    echo "Database connection failed. Please check your .env configuration:"
    echo "  - DATABASE_URL"
    echo "  - DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE"
    echo ""
    echo "Or run: npm run migration:run"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""

# Set environment variables
echo "⚙️  Environment Configuration"
echo "-----------------------------"

if [ "$AI_DISABLED" = "true" ]; then
    export AI_FEATURES_ENABLED=false
    echo "🚫 AI features disabled"
else
    export AI_FEATURES_ENABLED=true
    export OLLAMA_URL=http://localhost:11434
    export OLLAMA_MODEL=mistral
    echo "🤖 AI features enabled"
    echo "   Ollama URL: $OLLAMA_URL"
    echo "   Model: $OLLAMA_MODEL"
fi

# Show configuration
echo ""
echo "📊 System Status"
echo "---------------"
echo "Node.js: $(node --version)"
echo "Environment: ${NODE_ENV:-development}"
echo "Port: ${PORT:-3000}"
echo "AI Features: ${AI_FEATURES_ENABLED:-false}"

if [ "$AI_FEATURES_ENABLED" = "true" ]; then
    # Quick AI health check
    echo -n "AI Status: "
    if curl -s http://localhost:11434/api/version >/dev/null 2>&1; then
        echo "✅ Ready"
    else
        echo "⚠️  Limited"
    fi
fi

echo ""

# Start the application
echo "🎯 Starting Express Application"
echo "------------------------------"

# Choose start command based on environment
if [ "${NODE_ENV}" = "production" ]; then
    echo "Starting in production mode..."
    npm start
else
    echo "Starting in development mode..."
    echo "Press Ctrl+C to stop the server"
    echo ""

    # Start with appropriate settings
    if [ "$AI_FEATURES_ENABLED" = "true" ]; then
        echo "🤖 AI Chat features are available"
        echo "   WebSocket streaming: Enabled"
        echo "   User preferences: Enabled"
        echo "   Pattern learning: Enabled"
    else
        echo "ℹ️  Running without AI features"
        echo "   Install Ollama to enable AI chat"
    fi

    echo ""
    echo "🌐 Server will be available at:"
    echo "   Application: http://localhost:${PORT:-3000}"
    echo "   API Docs: http://localhost:${PORT:-3000}/api-docs"

    if [ "$AI_FEATURES_ENABLED" = "true" ]; then
        echo "   AI Service: http://localhost:11434"
    fi

    echo ""

    npm run dev
fi