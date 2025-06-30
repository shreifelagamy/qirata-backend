# WebSocket Refactoring Implementation Plan

## Overview
Refactor the WebSocket chat system to use a Laravel Broadcasting-style architecture with a unified chat controller that handles both Q&A and social post generation based on AI intent detection.

## Architecture Understanding
The user chats with an AI agent that:
1. Analyzes the user's message
2. Detects intent (question about post OR social post generation request)
3. Responds accordingly:
   - **Question Intent**: Answers based on post content and conversation history
   - **Social Post Intent**: Generates social media posts with user preferences

This is **ONE conversational flow**, not separate features, so we need **ONE controller**.

## Updated File Structure (Following Existing Patterns)
```
src/
├── controllers/
│   └── websocket/                     # NEW: WebSocket controllers subdirectory
│       └── chat.controller.ts         # Unified chat controller (Q&A + Social Generation)
├── middleware/
│   └── websocket.middleware.ts        # WebSocket-specific middleware
├── routes/
│   └── websocket.routes.ts            # NEW: Event routing configuration (Laravel style)
├── websocket/
│   ├── websocket.router.ts            # NEW: Route handler with middleware
│   ├── socket.service.ts              # EXISTING: Updated to use router
│   └── handlers/                      # EXISTING: Will be deprecated
│       ├── chat.handler.ts            # To be removed after migration
│       └── post.handler.ts            # To be removed after migration
└── services/
    ├── chat-session.service.ts        # EXISTING: Cleaned up business logic only
    └── ai/
        └── langchain.service.ts       # EXISTING: Already handles intent detection
```

## Implementation Steps

### 1. Create WebSocket Routes (`routes/websocket.routes.ts`)
```typescript
import { ChatController } from '../controllers/websocket/chat.controller';

interface SocketRoute {
  controller: any;
  method: string;
  middleware?: string[];
}

export const socketRoutes: Record<string, SocketRoute> = {
  // Main Chat Events (handles both Q&A and social generation)
  'chat:message': {
    controller: ChatController,
    method: 'handleMessage',
    middleware: ['auth', 'rateLimit']
  },

  'chat:interrupt': {
    controller: ChatController,
    method: 'handleInterrupt',
    middleware: ['auth']
  },

  'chat:join': {
    controller: ChatController,
    method: 'joinSession',
    middleware: ['auth']
  },

  'chat:leave': {
    controller: ChatController,
    method: 'leaveSession',
    middleware: ['auth']
  },

  // User Preferences (affects AI responses)
  'chat:preferences': {
    controller: ChatController,
    method: 'updatePreferences',
    middleware: ['auth']
  },

  // Legacy Events (backward compatibility)
  'messageReceived': {
    controller: ChatController,
    method: 'handleLegacyMessage'
  },

  'typingStatus': {
    controller: ChatController,
    method: 'handleTypingStatus'
  }
};
```

### 2. Create WebSocket Router (`websocket/websocket.router.ts`)
```typescript
import { AuthenticatedSocket } from '../types/socket.types';
import { socketRoutes } from './websocket.routes';
import { logger } from '../utils/logger';

export class WebSocketRouter {
  static async handleEvent(
    eventName: string,
    socket: AuthenticatedSocket,
    data: any
  ): Promise<void> {
    try {
      const route = socketRoutes[eventName];

      if (!route) {
        socket.emit('error', {
          message: `Unknown event: ${eventName}`,
          code: 'UNKNOWN_EVENT'
        });
        return;
      }

      // Apply middleware
      if (route.middleware) {
        const middlewareResult = await this.applyMiddleware(
          route.middleware,
          socket,
          data
        );
        if (!middlewareResult.success) {
          socket.emit('error', middlewareResult.error);
          return;
        }
      }

      // Create socket emitter function
      const emit = (event: string, responseData: any) => {
        socket.emit(event, responseData);
      };

      // Get controller instance and call method
      const controllerInstance = new route.controller();
      const handler = controllerInstance[route.method];

      if (typeof handler === 'function') {
        await handler.call(
          controllerInstance,
          data,
          socket.data.userId,
          socket,
          emit
        );
      } else {
        throw new Error(`Method ${route.method} not found in controller`);
      }

    } catch (error) {
      logger.error(`Error handling WebSocket event ${eventName}:`, error);
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'HANDLER_ERROR'
      });
    }
  }

  private static async applyMiddleware(
    middleware: string[],
    socket: AuthenticatedSocket,
    data: any
  ): Promise<{ success: boolean; error?: any }> {
    for (const middlewareName of middleware) {
      switch (middlewareName) {
        case 'auth':
          if (!socket.data.isAuthenticated) {
            return {
              success: false,
              error: {
                message: 'Authentication required',
                code: 'AUTH_REQUIRED'
              }
            };
          }
          break;

        case 'rateLimit':
          // TODO: Implement rate limiting logic
          break;
      }
    }
    return { success: true };
  }
}
```

### 3. Create Unified Chat Controller (`controllers/websocket/chat.controller.ts`)

This controller handles the **entire conversational flow**:

#### Main Responsibilities:
1. **Message Processing**: Handle user messages and determine AI response type
2. **Intent-Based Responses**:
   - Answer questions about post content
   - Generate social posts based on user requests
3. **Stream Management**: Handle real-time streaming of AI responses
4. **Session Management**: Join/leave chat sessions
5. **Preference Handling**: Update user preferences that affect AI behavior

#### Key Methods:
```typescript
export class ChatController {
  private chatSessionService = new ChatSessionService();
  private activeStreams = new Map<string, boolean>();

  /**
   * Main method - handles both Q&A and social generation
   * The AI service (LangChain) determines intent and responds accordingly
   */
  async handleMessage(
    data: { sessionId: string; content: string; preferences?: UserPreferences },
    userId: string,
    socket: AuthenticatedSocket,
    emit: (event: string, data: any) => void
  ): Promise<void> {
    // 1. Validate session
    // 2. Build AI context (post content + conversation + preferences)
    // 3. Stream AI response (AI determines if Q&A or social generation)
    // 4. Handle different response types:
    //    - Regular answer -> emit as text
    //    - Social posts -> emit as structured social post data
    // 5. Save to database
  }

  /**
   * Update user preferences that affect AI responses
   */
  async updatePreferences(
    data: { preferences: UserPreferences },
    userId: string,
    socket: AuthenticatedSocket,
    emit: (event: string, data: any) => void
  ): Promise<void> {
    // Update user preferences for future AI responses
  }

  // ... other methods for stream management, session join/leave, etc.
}
```

#### Response Flow Based on AI Intent:
```typescript
// In handleMessage method:
const streamCallback = (callbackData: AICallbackData) => {
  // Handle streaming for both types of responses
  switch (callbackData.event) {
    case 'start':
      emit('chat:stream:start', {
        sessionId,
        intentType: callbackData.intentType // 'question' or 'social_post'
      });
      break;

    case 'token':
      emit('chat:stream:token', {
        sessionId,
        token: callbackData.token
      });
      break;

    case 'end':
      // Different handling based on intent
      if (callbackData.intentType === 'social_post') {
        emit('chat:social:generated', {
          sessionId,
          posts: callbackData.socialPosts, // Structured social post data
          content: callbackData.content    // AI explanation
        });
      } else {
        emit('chat:stream:end', {
          sessionId,
          content: callbackData.content    // Regular Q&A response
        });
      }
      break;
  }
};
```

### 4. Update Socket Service (`websocket/socket.service.ts`)
Simplified to use the router:
```typescript
private setupEventHandlers(): void {
  this.io.on('connection', (socket: AuthenticatedSocket) => {
    this.handleConnection(socket);

    // Auto-register all events from routes
    Object.keys(socketRoutes).forEach(eventName => {
      socket.on(eventName, async (data) => {
        await WebSocketRouter.handleEvent(eventName, socket, data);
      });
    });

    // Standard connection events
    socket.on('disconnect', () => this.handleDisconnection(socket));
    socket.on('ping', () => socket.emit('pong'));
  });
}
```

### 5. Enhanced Chat Session Service (`services/chat-session.service.ts`)
Remove socket code, add helper methods:
```typescript
export class ChatSessionService {
  // Remove all socket emission and stream management

  async buildAIContext(sessionId: string, userPreferences?: UserPreferences): Promise<AIContext> {
    const session = await this.findOne(sessionId);
    const messages = await this.getRecentMessages(sessionId, 10);

    return {
      postContent: session?.post?.expanded?.content,
      previousMessages: messages,
      conversationSummary: session?.summary,
      userPreferences: userPreferences // Include preferences for AI
    };
  }

  async saveMessage(sessionId: string, userMessage: string, aiResponse: string): Promise<void> {
    // Save both Q&A and social generation results
  }

  async saveSocialPosts(sessionId: string, userMessage: string, posts: any[]): Promise<void> {
    // Save generated social posts if needed
  }
}
```

## Frontend Events
The frontend will receive different events based on AI intent:

**For Q&A:**
- `chat:stream:start` with `intentType: 'question'`
- `chat:stream:token` (streaming answer)
- `chat:stream:end` with text content

**For Social Generation:**
- `chat:stream:start` with `intentType: 'social_post'`
- `chat:stream:token` (streaming explanation)
- `chat:social:generated` with structured post data

## Key Benefits
1. **🎯 Unified Flow**: One controller handles the entire conversation
2. **🤖 AI-Driven**: Let the AI determine intent and response type
3. **🏗️ Follows Structure**: Uses existing patterns
4. **🔄 Simplified**: No need to manage separate workflows
5. **📱 Flexible**: Easy to add new intent types in the future
6. **🧪 Testable**: Single controller to test entire chat flow

## Migration Strategy
1. Create unified ChatController
2. Update routes to point to single controller
3. Test both Q&A and social generation flows
4. Remove old handlers
5. Update frontend to handle new event structure

This approach aligns perfectly with your AI agent concept - one intelligent conversation that adapts based on user intent!