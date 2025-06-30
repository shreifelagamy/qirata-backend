# AI Chat Streaming Infrastructure

This document describes the comprehensive AI chat streaming infrastructure implemented in the Express backend, including WebSocket integration, user preferences, pattern extraction, and LangChain AI processing.

## Overview

The AI chat streaming system provides real-time AI responses with user personalization through:

1. **WebSocket-based real-time streaming**
2. **User preference management (Style Wizard)**
3. **Pattern extraction and learning**
4. **LangChain integration with Ollama**
5. **Intent detection and context awareness**

## Architecture Components

### 1. WebSocket Infrastructure

#### Socket Types (`src/types/socket.types.ts`)
- **Enhanced event types** for AI streaming
- **User preferences interface** for style customization
- **Streaming data structures** for real-time communication

#### Socket Service (`src/websocket/socket.service.ts`)
- **Authentication middleware** with user ID extraction
- **Event handler registration** for chat events
- **Connection management** with cleanup

#### Chat Handler (`src/websocket/handlers/chat.handler.ts`)
- **AI message processing** with streaming
- **Stream interruption** handling
- **Session management** (join/leave)
- **Pattern extraction** integration

### 2. User Preferences System

#### Preferences Service (`src/services/ai/preferences.service.ts`)
- **Style Wizard profiles**: Pre-defined personality templates
  - `data_analyst`: Professional, data-focused
  - `thought_leader`: Direct, provocative
  - `community_builder`: Friendly, practical
  - `storyteller`: Narrative-driven
- **User preference storage** in settings
- **Dynamic preference updates**

#### Style Wizard Profiles
```typescript
{
  voice: 'professional' | 'friendly' | 'direct' | 'storyteller',
  contentStyle: 'data-driven' | 'practical' | 'thought-provoking',
  hookPreference: 'questions' | 'observations' | 'bold-claims',
  platform: 'twitter' | 'linkedin' | 'general',
  length: 'short' | 'medium' | 'long'
}
```

### 3. Pattern Extraction System

#### Pattern Service (`src/services/ai/pattern-extraction.service.ts`)
- **Request pattern detection**: Analyzes user requests for preferences
- **Vocabulary analysis**: Tracks language style preferences
- **Platform behavior**: Learns platform-specific patterns
- **Style feedback**: Adapts based on user corrections

#### Pattern Types
- **Request patterns**: Length preferences, emoji usage, hashtag preferences
- **Vocabulary patterns**: Formality level, enthusiasm, technical language
- **Platform patterns**: Twitter vs LinkedIn behavior
- **Style patterns**: Tone and format preferences

### 4. LangChain Integration

#### LangChain Service (`src/services/ai/langchain.service.ts`)
- **Ollama model integration** for local AI processing
- **Streaming callback handler** for real-time responses
- **Enhanced prompt building** with user context
- **Intent detection** (question vs social post)
- **Session memory management**

#### Enhanced Features
- **Dynamic prompt templates** with user preferences
- **Pattern insight integration** in AI context
- **Multi-modal responses** based on intent
- **Token estimation** and memory management

### 5. Chat Session Integration

#### Chat Session Service (`src/services/chat-session.service.ts`)
- **Enhanced streaming** with preference integration
- **Pattern extraction** trigger after responses
- **Context building** from post content and history
- **User preference loading** and application

## WebSocket Events

### Client to Server Events

```typescript
// AI Chat message
'chat:message': {
  sessionId: string,
  content: string,
  postId?: string,
  context?: {
    userPreferences?: UserPreferences
  }
}

// Stream interruption
'chat:interrupt': {
  sessionId: string,
  reason?: string
}

// Session management
'chat:join': sessionId
'chat:leave': sessionId
```

### Server to Client Events

```typescript
// Streaming events
'chat:stream:start': { sessionId, intentType? }
'chat:stream:token': { sessionId, token }
'chat:stream:end': { sessionId, fullContent }
'chat:stream:error': { sessionId, error }
'chat:stream:interrupted': { sessionId }

// Intent detection
'chat:intent:detected': { sessionId, intent, confidence }
```

## REST API Endpoints

### Preferences Management

```
GET    /api/preferences/style-profiles
GET    /api/preferences/{userId}
PUT    /api/preferences/{userId}
POST   /api/preferences/{userId}/apply-profile
POST   /api/preferences/{userId}/reset
GET    /api/preferences/{userId}/summary
```

### Pattern Analysis

```
GET    /api/preferences/{userId}/patterns
GET    /api/preferences/{userId}/patterns/insights
DELETE /api/preferences/{userId}/patterns
```

## Usage Flow

### 1. Initial Setup
1. User connects via WebSocket with authentication token
2. System extracts user ID and initializes socket data
3. User preferences are loaded or defaults applied

### 2. Chat Interaction
1. Client sends `chat:message` event with content and session ID
2. System loads user preferences and pattern insights
3. AI context is built with post content, history, and personalization
4. LangChain processes message with streaming callbacks
5. Real-time tokens are sent via WebSocket
6. Pattern extraction runs asynchronously after completion

### 3. Preference Learning
1. User messages are analyzed for patterns
2. Patterns are stored and frequency tracked
3. Future AI responses incorporate learned preferences
4. Style Wizard profiles can be applied for quick setup

## Configuration

### Environment Variables

```env
# LangChain/Ollama Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=mistral
AI_MAX_TOKENS=2048
AI_TEMPERATURE=0.7
AI_MEMORY_TOKEN_LIMIT=1000
AI_SESSION_CLEANUP_MINUTES=30

# WebSocket Configuration
FRONTEND_URL=http://localhost:3000
```

### Database Storage

User preferences and patterns are stored in the `settings` table:
- Key: `user_preferences_{userId}` for preferences
- Key: `user_patterns_{userId}` for pattern analysis
- Value: JSON serialized data

## Integration Examples

### Frontend WebSocket Connection

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: 'user_demo_123' // or base64 encoded JWT
  }
});

// Join chat session
socket.emit('chat:join', sessionId);

// Send message
socket.emit('chat:message', {
  sessionId: 'session-uuid',
  content: 'Create a LinkedIn post about AI',
  context: {
    userPreferences: {
      voice: 'professional',
      platform: 'linkedin',
      length: 'medium'
    }
  }
});

// Listen for streaming responses
socket.on('chat:stream:token', ({ sessionId, token }) => {
  // Append token to UI
  appendToMessage(sessionId, token);
});

socket.on('chat:stream:end', ({ sessionId, fullContent }) => {
  // Streaming complete
  finalizeMessage(sessionId, fullContent);
});
```

### REST API Usage

```javascript
// Get user preferences
const preferences = await fetch('/api/preferences/demo_user').then(r => r.json());

// Apply style wizard profile
await fetch('/api/preferences/demo_user/apply-profile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ profileKey: 'thought_leader' })
});

// Update specific preferences
await fetch('/api/preferences/demo_user', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    voice: 'storyteller',
    platform: 'twitter'
  })
});
```

## Performance Considerations

### Memory Management
- Session memories are automatically cleaned up after 30 minutes of inactivity
- Pattern data is stored efficiently with frequency tracking
- Token estimation prevents memory overflow

### Scalability
- WebSocket connections are managed per instance
- User preferences are cached in service layer
- Pattern extraction runs asynchronously to avoid blocking

### Error Handling
- Stream interruption handling for disconnections
- Graceful fallbacks for missing preferences
- Comprehensive error logging and user feedback

## Future Enhancements

1. **Advanced Pattern Recognition**: ML-based pattern detection
2. **Multi-Model Support**: Support for different AI models
3. **Real-time Collaboration**: Multi-user chat sessions
4. **Analytics Dashboard**: Usage patterns and performance metrics
5. **Advanced Personalization**: Context-aware preference adaptation

## Troubleshooting

### Common Issues

1. **WebSocket Connection Fails**
   - Check CORS configuration
   - Verify authentication token format
   - Ensure frontend URL is whitelisted

2. **Streaming Stops Mid-Response**
   - Check Ollama service status
   - Verify model availability
   - Monitor memory usage

3. **Preferences Not Applied**
   - Verify user ID extraction
   - Check database connection
   - Ensure pattern service initialization

### Debug Logging

Enable debug logging for troubleshooting:

```javascript
// In logger configuration
logger.level = 'debug';

// View specific service logs
logger.debug('Pattern extraction results:', patterns);
logger.debug('Enhanced AI context:', aiContext);
```

This infrastructure provides a robust foundation for AI-powered chat experiences with deep personalization and real-time streaming capabilities.