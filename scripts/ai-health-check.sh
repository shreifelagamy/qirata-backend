#!/bin/bash

echo "🔍 AI System Health Check"
echo "=========================="

# Check Ollama connectivity
echo -n "Checking Ollama service... "
if curl -s http://localhost:11434/api/version > /dev/null 2>&1; then
    echo "✅ Running"

    # Get Ollama version
    version=$(curl -s http://localhost:11434/api/version | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
    echo "   Version: $version"
else
    echo "❌ Not accessible"
    echo "   Please start Ollama with: ollama serve"
    exit 1
fi

# Check model availability
echo -n "Checking Mistral model... "
if ollama list 2>/dev/null | grep -q "mistral"; then
    echo "✅ Available"

    # Get model info
    size=$(ollama list | grep mistral | awk '{print $2}')
    echo "   Size: $size"
else
    echo "❌ Not found"
    echo "   Please download with: ollama pull mistral"
    exit 1
fi

# Test basic AI generation
echo -n "Testing AI generation... "
response=$(curl -s -X POST http://localhost:11434/api/generate \
    -H "Content-Type: application/json" \
    -d '{"model": "mistral", "prompt": "Hello", "stream": false}' \
    --max-time 30)

if echo "$response" | grep -q "response"; then
    echo "✅ Working"

    # Extract and show response
    ai_response=$(echo "$response" | grep -o '"response":"[^"]*"' | cut -d'"' -f4 | head -c 50)
    echo "   Sample response: ${ai_response}..."
else
    echo "❌ Failed"
    echo "   Response: $response"
    exit 1
fi

# Check system resources
echo -n "Checking system memory... "
if command -v free > /dev/null; then
    mem_total=$(free -h | awk '/^Mem:/ {print $2}')
    mem_available=$(free -h | awk '/^Mem:/ {print $7}')
    echo "✅ Total: $mem_total, Available: $mem_available"
elif command -v vm_stat > /dev/null; then
    # macOS
    mem_total=$(sysctl hw.memsize | awk '{print int($2/1024/1024/1024)"GB"}')
    echo "✅ Total: ${mem_total}"
else
    echo "⚠️  Cannot determine memory info"
fi

# Check disk space for model storage
echo -n "Checking disk space... "
if command -v df > /dev/null; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        disk_space=$(df -h ~ | tail -1 | awk '{print $4}')
    else
        # Linux
        disk_space=$(df -h ~ | tail -1 | awk '{print $4}')
    fi
    echo "✅ Available: $disk_space"
else
    echo "⚠️  Cannot determine disk space"
fi

# Check if Express backend can connect to Ollama
echo -n "Testing backend AI integration... "
if command -v node > /dev/null && [ -f "src/services/ai/langchain.service.ts" ]; then
    echo "✅ AI service files present"
else
    echo "⚠️  Backend AI service not found"
fi

# Check environment variables
echo -n "Checking environment configuration... "
env_issues=0

if [ -z "$OLLAMA_URL" ] && [ ! -f ".env" ]; then
    echo "⚠️  OLLAMA_URL not set (will use default: http://localhost:11434)"
else
    echo "✅ Environment configured"
fi

echo ""
echo "🎉 AI System Health Check Complete!"
echo ""
echo "Next steps:"
echo "1. Start Express backend: npm run dev"
echo "2. Test AI chat in the frontend application"
echo "3. Run comprehensive tests: npm run ai:test"
echo ""
echo "For troubleshooting, see: docs/OLLAMA_SETUP.md"