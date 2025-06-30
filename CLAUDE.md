# Express Backend AI Service - Development Context

## Project Overview
This is an Express.js backend application with TypeScript that integrates AI services using LangChain and Ollama for real-time chat functionality with WebSocket support.

## Recent Development Context

### AI Platform Detection Enhancement (December 2024)

**Project**: Qirata Express Backend - AI-powered platform detection with Zod validation

#### Latest Updates:
1. **AI-Powered Platform Detection**:
   - **Replaced Keyword Matching**: Migrated from manual keyword detection to AI-based analysis
   - **Zod Schema Validation**: Implemented structured output parsing with Zod for type safety
   - **Multi-language Support**: Enhanced support for Arabic platform names (تويتر، لينكد إن، فيسبوك، انستغرام)
   - **Conservative Detection**: Only detects platforms with explicit mentions, not contextual inference

2. **Structured Output with Zod**:
   ```typescript
   const PlatformDetectionSchema = z.object({
       platform: z.enum(['twitter', 'linkedin', 'facebook', 'instagram']).nullable(),
       confidence: z.number().min(0).max(1),
       needsClarification: z.boolean(),
       reasoning: z.string()
   });
   ```

3. **Conservative Detection Strategy**:
   - **Explicit Only**: Only detects platforms when explicitly mentioned (no inference from content type)
   - **Clarification First**: Returns `needsClarification: true` and `confidence: 0` when no platform is mentioned
   - **Fallback Protection**: Maintains keyword-based fallback for AI failures
   - **Conversation Context**: Analyzes chat history for previous platform discussions

4. **Enhanced Error Handling**:
   - Schema validation ensures consistent response structure
   - Graceful fallback to keyword detection
   - Comprehensive logging for debugging

### LangGraph Chat Service Refactoring (December 2024)

**Project**: Qirata Express Backend - Modular LangGraph architecture implementation

#### Completed Work:
1. **Refactored LangGraph Chat Service Architecture**:
   - **Modular Node Structure**: Extracted all workflow nodes into separate files for better maintainability
   - **Base Node Pattern**: Created abstract `BaseNode` class with common functionality (logging, error handling, token estimation)
   - **Routing Separation**: Isolated routing logic into dedicated router classes
   - **Workflow Builder**: Centralized workflow construction logic into `WorkflowBuilder` class

2. **New Directory Structure**:
   ```
   src/services/ai/langgraph/
   ├── nodes/
   │   ├── base-node.ts                    # Abstract base class for all nodes
   │   ├── load-content-node.ts            # Context loading functionality
   │   ├── intent-detection-node.ts        # Intent detection logic
   │   ├── platform-detection-node.ts      # Platform detection for social posts
   │   ├── platform-clarification-node.ts  # Platform clarification handling
   │   ├── question-handler-node.ts        # Q&A processing with streaming
   │   ├── social-post-generator-node.ts   # Social post generation with streaming
   │   ├── update-memory-node.ts           # Memory management
   │   └── index.ts                        # Node exports
   ├── routers/
   │   ├── intent-router.ts                # Intent-based routing logic
   │   ├── platform-router.ts              # Platform-based routing logic
   │   └── index.ts                        # Router exports
   ├── builders/
   │   ├── workflow-builder.ts             # Workflow construction logic
   │   └── index.ts                        # Builder exports
   └── index.ts                            # Main langgraph exports
   ```

3. **Key Improvements**:
   - **Separation of Concerns**: Each node handles a single responsibility
   - **Reusable Components**: Common functionality abstracted to base classes
   - **Clean Architecture**: Easy to extend and maintain individual components
   - **Type Safety**: Maintained strict TypeScript compilation
   - **Stream Support**: WebSocket streaming callbacks preserved in relevant nodes
   - **Error Handling**: Centralized error handling patterns

4. **Build Status**: All TypeScript compilation errors resolved, project builds successfully

#### Previous Fixes:
1. **Fixed TypeScript Compilation Errors** (Earlier in December):
   - [`langchain.service.ts`](src/services/ai/langchain.service.ts:135): Added missing semicolon after `chain.invoke()` call
   - [`langchain.service.ts`](src/services/ai/langchain.service.ts:145): Fixed uninitialized variable type declaration for `socialPlatform`
   - [`social-post-generator.service.ts`](src/services/ai/social-post-generator.service.ts:84): Fixed type mismatch by changing `SocialPlatform | null` to `SocialPlatform | undefined`

#### Stream Cancellation Feature (Already Implemented)
The LangGraph service already includes stream cancellation functionality:
- **AbortController Integration**: Session-based request cancellation using `Map<string, AbortController>`
- **Graceful Cancellation**: Proper cleanup and client notification on cancellation
- **Session Management**: Active request tracking per session

**Key Files**:
- [`src/services/ai/langgraph-chat.service.ts`](src/services/ai/langgraph-chat.service.ts) - Main LangGraph service with modular architecture
- [`src/services/ai/langgraph/`](src/services/ai/langgraph/) - Modular components directory
- [`src/controllers/websocket/chat.controller.ts`](src/controllers/websocket/chat.controller.ts) - WebSocket controller for session management
- [`src/types/ai.types.ts`](src/types/ai.types.ts) - AI-related type definitions
- [`src/types/socket.types.ts`](src/types/socket.types.ts) - WebSocket event types

## Architecture Overview

### AI Services
- **LangGraph Chat Service**: Modular workflow-based AI orchestration using LangChain's LangGraph
- **LangChain Integration**: Primary AI orchestration service (legacy)
- **Ollama Integration**: Local AI model hosting
- **Social Post Generator**: Platform-specific content generation (Twitter, LinkedIn, Facebook, Instagram)
- **Intent Detection**: Distinguishing between Q&A and social post generation
- **Memory Service**: Conversation history and context management

### WebSocket Implementation
- **Real-time Chat**: Socket.IO based messaging
- **Session Management**: Per-session state tracking
- **Stream Handling**: Real-time AI response streaming

### Key Technical Components
- **TypeScript**: Strict type checking enabled
- **Express.js**: Backend framework
- **Socket.IO**: WebSocket implementation
- **LangGraph**: State-based workflow orchestration
- **AbortController**: Request cancellation for stream management
- **Session-based Processing**: Concurrent AI request management
- **Modular Architecture**: Separated nodes, routers, and builders for maintainability

## Development Notes
- Project builds successfully with modular LangGraph architecture
- Stream cancellation feature implemented and working
- Modular node architecture allows easy extension and maintenance
- All necessary type definitions and interfaces are in place
- WebSocket infrastructure supports real-time AI streaming
- Each workflow node can be independently tested and modified
- Router logic separated for clean conditional flow management

## Memories
- Added memory placeholder to memorize