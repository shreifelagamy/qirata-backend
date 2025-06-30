# API Documentation

## Summary
This document provides comprehensive documentation for the Qirata Express backend API. It covers authentication mechanisms, rate limiting policies, all available REST endpoints, WebSocket events, and error handling. This guide is essential for frontend developers integrating with the backend and third-party developers consuming our API.

Key sections:
- Authentication details and JWT token usage
- Rate limiting policies and quotas
- REST API endpoints with request/response examples
- WebSocket events and real-time communication
- Error handling and status codes

## Authentication
Authentication is handled via JWT tokens. Include the token in the Authorization header:
```
Authorization: Bearer <your_token>
```

## Rate Limiting
API endpoints are rate limited to:
- 100 requests per minute for authenticated users
- 20 requests per minute for unauthenticated users

## API Endpoints

### Links

#### GET /api/links
Get all links with pagination

**Query Parameters:**
- page (optional): Page number (default: 1)
- limit (optional): Items per page (default: 10)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "url": "string",
      "title": "string",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ],
  "meta": {
    "total": "number",
    "page": "number",
    "limit": "number"
  }
}
```

#### POST /api/links
Create a new link

**Request Body:**
```json
{
  "url": "string",
  "title": "string"
}
```

### Posts

#### GET /api/posts
Get all posts with pagination

**Query Parameters:**
- page (optional): Page number (default: 1)
- limit (optional): Items per page (default: 10)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "string",
      "content": "string",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ],
  "meta": {
    "total": "number",
    "page": "number",
    "limit": "number"
  }
}
```

### Chat Sessions with AI Integration

#### GET /api/chat-sessions
Get all chat sessions with pagination

**Query Parameters:**
- page (optional): Page number (default: 1)
- pageSize (optional): Items per page (default: 10)

**Response:**
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "string",
        "postId": "uuid",
        "createdAt": "string"
      }
    ],
    "total": "number",
    "page": "number",
    "pageSize": "number",
    "totalPages": "number"
  },
  "status": 200
}
```

#### POST /api/chat-sessions
Create a new chat session

**Request Body:**
```json
{
  "title": "string",
  "postId": "uuid" // optional
}
```

#### GET /api/chat-sessions/{id}
Get a specific chat session with details

#### GET /api/chat-sessions/{id}/messages
Get messages for a chat session

**Query Parameters:**
- page (optional): Page number (default: 1)
- pageSize (optional): Items per page (default: 20)

#### POST /api/chat-sessions/{id}/send-message
Send a message to AI and get response

**Request Body:**
```json
{
  "message": "string",
  "postContent": "string", // optional
  "userPreferences": {
    "tone": "professional|casual|formal",
    "platform": "twitter|linkedin|general",
    "length": "short|medium|long"
  }
}
```

**Response:**
```json
{
  "message": {
    "id": "uuid",
    "userMessage": "string",
    "aiResponse": "string",
    "createdAt": "string"
  },
  "aiResponse": {
    "content": "string",
    "intent": {
      "type": "question|social_post",
      "confidence": 0.95,
      "keywords": ["create", "post"]
    },
    "sessionId": "uuid",
    "tokenCount": 150,
    "processingTime": 1500
  },
  "session": {
    "id": "uuid",
    "title": "string"
  }
}
```

#### POST /api/chat-sessions/{id}/stream-message
Send a message and stream AI response via WebSocket

**Request Body:** Same as send-message

**Response:**
```json
{
  "sessionId": "uuid",
  "isComplete": true,
  "content": "string",
  "error": "string" // if error occurred
}
```

#### DELETE /api/chat-sessions/{id}/clear-memory
Clear AI session memory

**Response:**
```json
{
  "success": true,
  "message": "Session memory cleared successfully"
}
```

#### GET /api/chat-sessions/ai/stats
Get AI service statistics

**Response:**
```json
{
  "totalSessions": 5,
  "totalTokens": 12500
}
```

#### GET /api/chat-sessions/ai/test-connection
Test AI service connection

**Response:**
```json
{
  "connected": true,
  "message": "AI service connected successfully"
}
```

### WebSocket Events

#### Connection
```javascript
socket.connect('ws://localhost:3000');
```

#### AI Chat Streaming Events

##### ai:stream:start
AI response streaming started:
```javascript
socket.on('ai:stream:start', (data) => {
  // { sessionId: 'uuid', event: 'start' }
});
```

##### ai:stream:token
Receive streaming tokens:
```javascript
socket.on('ai:stream:token', (data) => {
  // { sessionId: 'uuid', event: 'token', token: 'word' }
});
```

##### ai:stream:end
AI response streaming completed:
```javascript
socket.on('ai:stream:end', (data) => {
  // { sessionId: 'uuid', event: 'end' }
});
```

##### ai:stream:error
AI response streaming error:
```javascript
socket.on('ai:stream:error', (data) => {
  // { sessionId: 'uuid', event: 'error', error: 'message' }
});
```

#### Chat Events

##### chat:message
Send a chat message:
```javascript
socket.emit('chat:message', {
  sessionId: 'uuid',
  content: 'string'
});
```

Receive chat messages:
```javascript
socket.on('chat:message', (message) => {
  // Handle new message
});
```

#### Post Events

##### post:created
Triggered when a new post is created:
```javascript
socket.on('post:created', (post) => {
  // Handle new post
});
```

### AI Integration Features

#### Intent Detection
The AI service automatically detects user intent based on keywords:

**Social Post Generation Keywords:**
- create, write, generate, post, tweet, linkedin
- compose, draft, publish, share, social

**Question/Answer Mode:**
- Everything else defaults to Q&A about post content

#### Memory Management
- **ConversationSummaryBufferMemory**: Maintains context with 1000 token limit
- **Session Cleanup**: Inactive sessions cleaned up after 30 minutes
- **Token Tracking**: Monitors token usage across all sessions

#### User Preferences
Configure AI responses with:
- **Tone**: professional, casual, formal
- **Platform**: twitter, linkedin, general
- **Length**: short, medium, long

#### Error Handling
The AI service includes robust error handling for:
- Ollama connection failures
- Token limit exceeded
- Invalid session IDs
- Malformed requests

## Error Responses

All error responses follow this format:
```json
{
  "error": {
    "code": "string",
    "message": "string"
  }
}
```

Common error codes:
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 429: Too Many Requests
- 500: Internal Server Error