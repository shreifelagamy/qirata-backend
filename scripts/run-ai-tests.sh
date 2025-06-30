#!/bin/bash

echo "🧪 Running AI Integration Test Suite"
echo "===================================="

# Check if Ollama is running first
echo "Checking prerequisites..."
if ! curl -s http://localhost:11434/api/version > /dev/null 2>&1; then
    echo "❌ Ollama is not running. Please start it with: ollama serve"
    exit 1
fi

if ! ollama list 2>/dev/null | grep -q "mistral"; then
    echo "❌ Mistral model not found. Please download with: ollama pull mistral"
    exit 1
fi

echo "✅ Prerequisites met"
echo ""

# Set test environment
export NODE_ENV=test
export LOG_LEVEL=error
export AI_MAX_TOKENS=512
export AI_SESSION_CLEANUP_MINUTES=1

# Function to run tests with proper error handling
run_test() {
    local test_name="$1"
    local test_command="$2"

    echo "🔍 Running $test_name..."
    if eval "$test_command"; then
        echo "✅ $test_name passed"
    else
        echo "❌ $test_name failed"
        exit 1
    fi
    echo ""
}

# Run AI service unit tests
if [ -d "src/services/ai" ]; then
    echo "📋 AI Service Unit Tests"
    echo "------------------------"

    for service_file in src/services/ai/*.service.ts; do
        if [ -f "$service_file" ]; then
            service_name=$(basename "$service_file" .service.ts)
            test_file="src/services/ai/${service_name}.service.test.ts"

            if [ -f "$test_file" ]; then
                run_test "${service_name} service tests" "npm test $test_file"
            else
                echo "⚠️  No test file found for $service_name service"
            fi
        fi
    done
else
    echo "⚠️  AI services directory not found"
fi

# Run integration tests
echo "🔗 AI Integration Tests"
echo "-----------------------"

integration_tests=(
    "src/tests/ai-streaming.test.ts"
    "src/tests/websocket-streaming.test.js"
    "src/tests/ai-integration.test.js"
    "src/tests/e2e-chat.test.js"
)

for test_file in "${integration_tests[@]}"; do
    if [ -f "$test_file" ]; then
        test_name=$(basename "$test_file" | sed 's/\.[^.]*$//')
        run_test "$test_name" "npm test $test_file"
    else
        echo "⚠️  Test file not found: $test_file"
    fi
done

# Run performance tests
echo "⚡ AI Performance Tests"
echo "----------------------"

performance_tests=(
    "src/tests/ai-performance.test.js"
    "src/tests/memory-leak.test.js"
)

for test_file in "${performance_tests[@]}"; do
    if [ -f "$test_file" ]; then
        test_name=$(basename "$test_file" | sed 's/\.[^.]*$//')
        run_test "$test_name" "npm test $test_file"
    else
        echo "ℹ️  Performance test not found: $test_file (optional)"
    fi
done

# Manual API tests
echo "🌐 API Endpoint Tests"
echo "--------------------"

if command -v curl > /dev/null; then
    # Test preferences endpoints
    echo "Testing preferences API..."

    # Get style profiles
    if curl -s http://localhost:3000/api/v1/preferences/style-profiles > /dev/null; then
        echo "✅ Style profiles endpoint working"
    else
        echo "⚠️  Style profiles endpoint not responding (backend may not be running)"
    fi

    # Test health endpoint if it exists
    if curl -s http://localhost:3000/health > /dev/null; then
        echo "✅ Health endpoint working"
    else
        echo "ℹ️  No health endpoint found"
    fi
else
    echo "⚠️  curl not available for API testing"
fi

echo ""

# Memory usage check
echo "💾 Memory Usage Check"
echo "--------------------"

if command -v ps > /dev/null; then
    ollama_pid=$(pgrep ollama)
    if [ -n "$ollama_pid" ]; then
        memory_usage=$(ps -o pid,rss,vsz,comm -p "$ollama_pid" | tail -1)
        echo "Ollama process: $memory_usage"

        # Check if memory usage is reasonable (less than 4GB RSS)
        rss_mb=$(echo "$memory_usage" | awk '{print int($2/1024)}')
        if [ "$rss_mb" -lt 4096 ]; then
            echo "✅ Memory usage is reasonable (${rss_mb}MB)"
        else
            echo "⚠️  High memory usage (${rss_mb}MB)"
        fi
    else
        echo "⚠️  Ollama process not found"
    fi
else
    echo "⚠️  Cannot check memory usage"
fi

echo ""

# Generate test report
echo "📊 Test Summary"
echo "==============="

total_tests=0
passed_tests=0

# Count test files that exist
for test_dir in "src/services/ai" "src/tests"; do
    if [ -d "$test_dir" ]; then
        test_count=$(find "$test_dir" -name "*.test.*" | wc -l)
        total_tests=$((total_tests + test_count))
    fi
done

echo "Total AI test files: $total_tests"
echo "AI services: $(ls src/services/ai/*.service.ts 2>/dev/null | wc -l)"
echo "WebSocket handlers: $(ls src/websocket/handlers/*.ts 2>/dev/null | wc -l)"

# Check test coverage if available
if command -v npm > /dev/null && npm list --depth=0 2>/dev/null | grep -q "nyc\|jest\|c8"; then
    echo ""
    echo "Running coverage analysis..."
    npm run test:coverage 2>/dev/null || echo "Coverage analysis not configured"
fi

echo ""
echo "🎉 AI Integration Test Suite Complete!"
echo ""

# Cleanup recommendations
echo "🧹 Cleanup Recommendations"
echo "-------------------------"
echo "1. Clean up test data: psql -d qirata_test_db -c \"DELETE FROM settings WHERE key LIKE '%test%';\""
echo "2. Restart Ollama if memory usage is high: pkill ollama && ollama serve"
echo "3. Check logs for any warnings: tail -f logs/combined.log"
echo ""

echo "For detailed test documentation, see: docs/AI_TESTING.md"