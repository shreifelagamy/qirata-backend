# AI Integration Testing Guide

This guide provides comprehensive testing procedures for the AI chat functionality, including LangChain service testing, WebSocket streaming, user preferences, and pattern extraction verification.

## Overview

The AI integration testing covers:
- LangChain service functionality
- WebSocket streaming performance
- User preferences system
- Pattern extraction and learning
- End-to-end AI chat functionality
- Error handling and edge cases

## Prerequisites

Before running tests, ensure:
- Ollama is installed and running at `http://localhost:11434`
- Mistral model is downloaded (`ollama pull mistral`)
- Express backend is configured with proper environment variables
- Database is set up and migrations are run

## Test Environment Setup

### 1. Environment Configuration

Create a test environment file:

```bash
# express-backend/.env.test
DATABASE_URL=postgresql://username:password@localhost:5432/qirata_test_db
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=mistral
AI_MAX_TOKENS=512
AI_TEMPERATURE=0.7
AI_MEMORY_TOKEN_LIMIT=500
AI_SESSION_CLEANUP_MINUTES=5
LOG_LEVEL=debug
```

### 2. Test Database Setup

```bash
# Create test database
createdb qirata_test_db

# Run migrations
NODE_ENV=test npm run migration:run
```

### 3. Start Test Services

```bash
# Terminal 1: Start Ollama (if not running)
ollama serve

# Terminal 2: Start backend with test config
NODE_ENV=test npm run dev
```

## Unit Tests

### 1. LangChain Service Tests

Test the core AI functionality:

```bash
# Run LangChain service tests
npm test src/services/ai/langchain.service.test.ts
```

**Manual Testing:**

```javascript
// Test basic AI response
const { LangChainService } = require('../src/services/ai/langchain.service');

async function testBasicResponse() {
  const service = new LangChainService();

  try {
    const response = await service.generateResponse(
      'Hello, how are you?',
      'demo_user',
      {}
    );

    console.log('✅ Basic response:', response);
  } catch (error) {
    console.error('❌ Basic response failed:', error);
  }
}

testBasicResponse();
```

### 2. Preferences Service Tests

Test user preference management:

```bash
# Run preferences tests
npm test src/services/ai/preferences.service.test.ts
```

**Manual Testing:**

```javascript
const { PreferencesService } = require('../src/services/ai/preferences.service');

async function testPreferences() {
  const service = new PreferencesService();

  // Test applying style profile
  await service.applyStyleProfile('test_user', 'thought_leader');

  // Test getting preferences
  const prefs = await service.getUserPreferences('test_user');
  console.log('✅ User preferences:', prefs);

  // Test updating preferences
  await service.updateUserPreferences('test_user', {
    voice: 'storyteller',
    platform: 'twitter'
  });

  console.log('✅ Preferences updated successfully');
}

testPreferences();
```

### 3. Pattern Extraction Tests

Test pattern learning functionality:

```bash
# Run pattern extraction tests
npm test src/services/ai/pattern-extraction.service.test.ts
```

**Manual Testing:**

```javascript
const { PatternExtractionService } = require('../src/services/ai/pattern-extraction.service');

async function testPatternExtraction() {
  const service = new PatternExtractionService();

  // Test pattern detection
  const patterns = await service.extractUserPatterns(
    'test_user',
    'Make this shorter and add some emojis please'
  );

  console.log('✅ Extracted patterns:', patterns);

  // Test pattern insights
  const insights = await service.getPatternInsights('test_user');
  console.log('✅ Pattern insights:', insights);
}

testPatternExtraction();
```

## Integration Tests

### 1. WebSocket Streaming Tests

Test real-time AI streaming:

```javascript
// express-backend/src/tests/websocket-streaming.test.js
const io = require('socket.io-client');

describe('WebSocket AI Streaming', () => {
  let clientSocket;

  beforeEach((done) => {
    clientSocket = io('http://localhost:3000', {
      auth: { token: 'test_user_123' }
    });
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    clientSocket.close();
  });

  test('should stream AI response tokens', (done) => {
    let tokens = [];
    let streamStarted = false;

    clientSocket.on('chat:stream:start', ({ sessionId }) => {
      streamStarted = true;
      console.log('✅ Stream started for session:', sessionId);
    });

    clientSocket.on('chat:stream:token', ({ token }) => {
      tokens.push(token);
      console.log('📝 Received token:', token);
    });

    clientSocket.on('chat:stream:end', ({ fullContent }) => {
      expect(streamStarted).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
      expect(fullContent).toBeTruthy();
      console.log('✅ Stream completed. Total tokens:', tokens.length);
      console.log('📄 Full content:', fullContent);
      done();
    });

    clientSocket.on('chat:stream:error', ({ error }) => {
      done(new Error(`Stream error: ${error}`));
    });

    // Send test message
    clientSocket.emit('chat:message', {
      sessionId: 'test-session-123',
      content: 'Write a short haiku about coding',
      context: {
        userPreferences: {
          voice: 'poetic',
          length: 'short'
        }
      }
    });
  }, 30000);
});
```

**Manual WebSocket Testing:**

```bash
# Install wscat for manual testing
npm install -g wscat

# Connect to WebSocket
wscat -c "ws://localhost:3000/socket.io/?EIO=4&transport=websocket"

# Send auth message (adjust for your auth format)
# Then send chat message and observe streaming
```

### 2. End-to-End Chat Flow Tests

Test complete chat functionality:

```javascript
// express-backend/src/tests/e2e-chat.test.js
const request = require('supertest');
const io = require('socket.io-client');
const app = require('../app');

describe('End-to-End AI Chat', () => {
  test('complete chat session workflow', async () => {
    // 1. Set user preferences
    await request(app)
      .put('/api/preferences/test_user')
      .send({
        voice: 'professional',
        contentStyle: 'data-driven',
        platform: 'linkedin',
        length: 'medium'
      })
      .expect(200);

    // 2. Create chat session
    const sessionResponse = await request(app)
      .post('/api/chat-sessions')
      .send({
        title: 'Test AI Chat',
        userId: 'test_user'
      })
      .expect(201);

    const sessionId = sessionResponse.body.data.id;

    // 3. Connect WebSocket and test streaming
    const socket = io('http://localhost:3000', {
      auth: { token: 'test_user_123' }
    });

    await new Promise((resolve) => socket.on('connect', resolve));

    // 4. Test AI message streaming
    const streamPromise = new Promise((resolve, reject) => {
      let fullContent = '';

      socket.on('chat:stream:token', ({ token }) => {
        fullContent += token;
      });

      socket.on('chat:stream:end', ({ fullContent: finalContent }) => {
        expect(finalContent).toBeTruthy();
        expect(finalContent.length).toBeGreaterThan(50);
        resolve(finalContent);
      });

      socket.on('chat:stream:error', reject);
    });

    socket.emit('chat:message', {
      sessionId,
      content: 'Create a LinkedIn post about AI trends in 2024',
      context: {
        userPreferences: {
          voice: 'professional',
          platform: 'linkedin',
          length: 'medium'
        }
      }
    });

    const aiResponse = await streamPromise;
    console.log('✅ AI Response:', aiResponse);

    // 5. Verify message was saved
    const messagesResponse = await request(app)
      .get(`/api/chat-sessions/${sessionId}/messages`)
      .expect(200);

    expect(messagesResponse.body.data.length).toBe(2); // User + AI message

    socket.close();
  }, 60000);
});
```

## Performance Tests

### 1. Streaming Performance Tests

Test streaming latency and throughput:

```javascript
// express-backend/src/tests/performance.test.js
const io = require('socket.io-client');

describe('AI Streaming Performance', () => {
  test('streaming latency benchmarks', (done) => {
    const socket = io('http://localhost:3000', {
      auth: { token: 'perf_test_user' }
    });

    let startTime;
    let firstTokenTime;
    let tokenCount = 0;

    socket.on('connect', () => {
      startTime = Date.now();

      socket.emit('chat:message', {
        sessionId: 'perf-test-session',
        content: 'Write a detailed explanation of machine learning'
      });
    });

    socket.on('chat:stream:start', () => {
      console.log('📊 Stream start latency:', Date.now() - startTime, 'ms');
    });

    socket.on('chat:stream:token', ({ token }) => {
      tokenCount++;
      if (tokenCount === 1) {
        firstTokenTime = Date.now();
        console.log('📊 First token latency:', firstTokenTime - startTime, 'ms');
      }
    });

    socket.on('chat:stream:end', ({ fullContent }) => {
      const totalTime = Date.now() - startTime;
      const tokensPerSecond = (tokenCount * 1000) / (Date.now() - firstTokenTime);

      console.log('📊 Performance Metrics:');
      console.log(`   Total time: ${totalTime}ms`);
      console.log(`   Total tokens: ${tokenCount}`);
      console.log(`   Tokens/second: ${tokensPerSecond.toFixed(2)}`);
      console.log(`   Response length: ${fullContent.length} chars`);

      // Performance assertions
      expect(totalTime).toBeLessThan(30000); // Max 30 seconds
      expect(tokensPerSecond).toBeGreaterThan(1); // Min 1 token/second

      socket.close();
      done();
    });
  }, 45000);
});
```

### 2. Memory Usage Tests

Test memory consumption during streaming:

```javascript
// Memory monitoring during AI operations
function monitorMemoryUsage() {
  const used = process.memoryUsage();
  console.log('📊 Memory Usage:');
  for (let key in used) {
    console.log(`   ${key}: ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
  }
}

// Run before and after AI operations
setInterval(monitorMemoryUsage, 5000);
```

## Error Handling Tests

### 1. Ollama Connectivity Tests

Test behavior when Ollama is unavailable:

```javascript
describe('Ollama Error Handling', () => {
  test('handles Ollama service unavailable', async () => {
    // Mock Ollama unavailable
    process.env.OLLAMA_URL = 'http://localhost:99999';

    const socket = io('http://localhost:3000', {
      auth: { token: 'error_test_user' }
    });

    await new Promise((resolve) => socket.on('connect', resolve));

    const errorPromise = new Promise((resolve) => {
      socket.on('chat:stream:error', ({ error }) => {
        expect(error).toContain('connection');
        resolve();
      });
    });

    socket.emit('chat:message', {
      sessionId: 'error-test-session',
      content: 'Hello AI'
    });

    await errorPromise;
    socket.close();

    // Restore correct URL
    process.env.OLLAMA_URL = 'http://localhost:11434';
  });
});
```

### 2. Stream Interruption Tests

Test handling of interrupted streams:

```javascript
test('handles stream interruption gracefully', (done) => {
  const socket = io('http://localhost:3000', {
    auth: { token: 'interrupt_test_user' }
  });

  socket.on('connect', () => {
    socket.emit('chat:message', {
      sessionId: 'interrupt-test-session',
      content: 'Write a very long story about space exploration'
    });

    // Interrupt after 2 seconds
    setTimeout(() => {
      socket.emit('chat:interrupt', {
        sessionId: 'interrupt-test-session',
        reason: 'user_requested'
      });
    }, 2000);
  });

  socket.on('chat:stream:interrupted', ({ sessionId }) => {
    expect(sessionId).toBe('interrupt-test-session');
    console.log('✅ Stream interruption handled correctly');
    socket.close();
    done();
  });
});
```

## User Acceptance Tests

### 1. Style Wizard Workflow

Test the complete style wizard experience:

```bash
# Test applying different style profiles
curl -X POST http://localhost:3000/api/preferences/test_user/apply-profile \
  -H "Content-Type: application/json" \
  -d '{"profileKey": "data_analyst"}'

# Test AI response with data analyst style
# (Use WebSocket client to send message and verify response style)

# Repeat for other profiles: thought_leader, community_builder, storyteller
```

### 2. Pattern Learning Verification

Test that the system learns from user interactions:

```bash
# Send several requests with specific patterns
# Example: "Make it shorter", "Add emojis", "More professional tone"

# Check if patterns are being learned
curl http://localhost:3000/api/preferences/test_user/patterns/insights

# Verify insights reflect the patterns
# Expected: "Common requests: length_shorter, emoji_usage, tone_professional"
```

### 3. Multi-Session Testing

Test concurrent chat sessions:

```javascript
// Test multiple simultaneous sessions
const sessions = [
  { id: 'session-1', userId: 'user1' },
  { id: 'session-2', userId: 'user2' },
  { id: 'session-3', userId: 'user1' }
];

sessions.forEach(session => {
  const socket = io('http://localhost:3000', {
    auth: { token: `${session.userId}_token` }
  });

  socket.emit('chat:message', {
    sessionId: session.id,
    content: `Hello from ${session.id}`
  });
});
```

## Load Testing

### 1. Concurrent User Testing

Test system performance with multiple users:

```javascript
// Load test with artillery or similar tool
// artillery.yml
/*
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 5
scenarios:
  - name: "AI Chat Load Test"
    engine: socketio
    socketio:
      query:
        auth: "test_user_${$randomInt(1, 100)}"
    flow:
      - emit:
          channel: "chat:message"
          data:
            sessionId: "load-test-${$randomInt(1, 20)}"
            content: "Generate a social media post"
      - think: 10
*/
```

### 2. Memory Leak Detection

Long-running test to detect memory leaks:

```javascript
// Run extended test session
let sessionCount = 0;
const maxSessions = 1000;

function createTestSession() {
  if (sessionCount >= maxSessions) return;

  const socket = io('http://localhost:3000', {
    auth: { token: `leak_test_${sessionCount}` }
  });

  socket.emit('chat:message', {
    sessionId: `leak-session-${sessionCount}`,
    content: 'Test message for memory leak detection'
  });

  socket.on('chat:stream:end', () => {
    socket.close();
    sessionCount++;

    if (sessionCount % 100 === 0) {
      console.log(`📊 Completed ${sessionCount} sessions`);
      console.log('Memory usage:', process.memoryUsage());
    }

    setTimeout(createTestSession, 100);
  });
}

createTestSession();
```

## Automated Test Scripts

### 1. Quick Health Check

```bash
#!/bin/bash
# express-backend/scripts/ai-health-check.sh

echo "🔍 AI System Health Check"

# Check Ollama connectivity
echo "Checking Ollama..."
curl -s http://localhost:11434/api/version > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Ollama is running"
else
    echo "❌ Ollama is not accessible"
    exit 1
fi

# Check model availability
echo "Checking Mistral model..."
ollama list | grep mistral > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Mistral model is available"
else
    echo "❌ Mistral model not found"
    exit 1
fi

# Test basic AI generation
echo "Testing AI generation..."
response=$(curl -s -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model": "mistral", "prompt": "Hello", "stream": false}')

if [[ $response == *"response"* ]]; then
    echo "✅ AI generation working"
else
    echo "❌ AI generation failed"
    exit 1
fi

echo "🎉 All AI health checks passed!"
```

### 2. Full Integration Test Suite

```bash
#!/bin/bash
# express-backend/scripts/run-ai-tests.sh

echo "🧪 Running AI Integration Test Suite"

# Run unit tests
echo "Running unit tests..."
npm test src/services/ai/ || exit 1

# Run integration tests
echo "Running integration tests..."
npm test src/tests/ai-integration.test.js || exit 1

# Run performance tests
echo "Running performance tests..."
npm test src/tests/ai-performance.test.js || exit 1

# Run WebSocket tests
echo "Running WebSocket tests..."
npm test src/tests/websocket-streaming.test.js || exit 1

echo "🎉 All AI tests completed successfully!"
```

## Test Data Management

### 1. Test User Setup

```sql
-- Create test users and data
INSERT INTO settings (key, value) VALUES
('user_preferences_test_user', '{"voice": "professional", "platform": "linkedin"}'),
('user_patterns_test_user', '{"requestPatterns": {"length_shorter": 3}}');
```

### 2. Test Data Cleanup

```bash
#!/bin/bash
# Clean up test data after tests
psql -d qirata_test_db -c "DELETE FROM settings WHERE key LIKE '%test%';"
psql -d qirata_test_db -c "DELETE FROM chat_sessions WHERE user_id LIKE '%test%';"
psql -d qirata_test_db -c "DELETE FROM messages WHERE user_id LIKE '%test%';"
```

## Monitoring and Debugging

### 1. Enable Debug Logging

```bash
# Run with debug logging
DEBUG=ai:* LOG_LEVEL=debug npm run dev
```

### 2. WebSocket Debug

```javascript
// Enable Socket.IO debug logging
localStorage.debug = 'socket.io-client:socket';
```

### 3. Performance Monitoring

```javascript
// Add performance monitoring to services
const performanceMonitor = {
  startTime: Date.now(),

  logMetric(operation, duration, metadata = {}) {
    console.log(`📊 ${operation}: ${duration}ms`, metadata);
  }
};

// Use in AI services
const start = Date.now();
// ... AI operation
performanceMonitor.logMetric('ai_generation', Date.now() - start, {
  tokens: tokenCount,
  model: 'mistral'
});
```

## Troubleshooting Test Issues

### Common Test Failures

1. **WebSocket Connection Timeout**
   - Check if backend is running
   - Verify auth token format
   - Check CORS configuration

2. **AI Generation Timeout**
   - Verify Ollama is running and responsive
   - Check model availability
   - Increase test timeout values

3. **Pattern Tests Failing**
   - Clear test database before running
   - Verify settings table structure
   - Check JSON serialization

4. **Memory Tests Failing**
   - Run tests with sufficient memory
   - Close WebSocket connections properly
   - Use test-specific cleanup

### Debug Commands

```bash
# Check WebSocket connections
netstat -an | grep 3000

# Monitor backend logs
tail -f express-backend/logs/combined.log

# Check Ollama status
ollama ps

# Test database connectivity
psql -d qirata_test_db -c "SELECT COUNT(*) FROM settings;"
```

This comprehensive testing guide ensures your AI chat functionality is working correctly across all components and scenarios.