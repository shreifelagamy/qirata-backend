# Express Backend AI Service - Development Context

## Project Overview
This is an Express.js backend application with TypeScript that integrates AI services using LangChain and Ollama for real-time chat functionality with WebSocket support.

## Recent Development Context

### Centralized Model Configuration System (December 2024)

**Project**: Qirata Express Backend - Centralized AI model configuration for LangGraph workflow

#### Latest Updates:
1. **Centralized Model Management**:
   - **Per-Service Models**: Each workflow node can use a different model optimized for its specific task
   - **Environment-Based Configuration**: Model selection via environment variables with intelligent fallbacks
   - **Runtime Model Updates**: Ability to update model configurations and rebuild workflow without restart
   - **Specialized Configurations**: Pre-built configurations for development, production, and specialized use cases

2. **Model Configuration Structure**:
   ```typescript
   interface WorkflowModelConfigs {
       intentDetection: ModelConfig;      // Fast classification model
       platformDetection: ModelConfig;   // Deterministic detection model
       questionHandler: ModelConfig;      // Balanced Q&A model
       socialPostGenerator: ModelConfig; // Creative content model
       memoryService: ModelConfig;       // Efficient summarization model
   }
   ```

3. **Environment Variables for Model Control**:
   ```bash
   # Global settings
   OLLAMA_URL=http://localhost:11434
   OLLAMA_MODEL=mistral:7b  # Default fallback model
   
   # Service-specific models
   INTENT_MODEL=llama3:8b
   PLATFORM_MODEL=mistral:7b-instruct
   QUESTION_MODEL=mistral:7b
   SOCIAL_POST_MODEL=mistral:7b
   MEMORY_MODEL=llama3:8b
   
   # Service-specific temperatures
   INTENT_TEMPERATURE=0.3
   PLATFORM_TEMPERATURE=0.1
   QUESTION_TEMPERATURE=0.7
   SOCIAL_POST_TEMPERATURE=0.8
   MEMORY_TEMPERATURE=0.5
   ```

4. **Workflow Integration**:
   - **State-Based Models**: Models injected into workflow state and accessed by nodes
   - **Dynamic Service Creation**: Services instantiated with appropriate models at runtime
   - **Type-Safe Configuration**: Full TypeScript support for model configurations
   - **Error Handling**: Graceful fallbacks when models are unavailable

5. **Usage Examples**:
   ```typescript
   // Use default configuration
   const chatService = new LangGraphChatService();
   
   // Use custom configuration
   const customConfig = {
       intentDetection: { model: 'llama3:8b', temperature: 0.1 },
       questionHandler: { model: 'mistral:7b', temperature: 0.8 }
   };
   const chatService = new LangGraphChatService(customConfig);
   
   // Update configuration at runtime
   chatService.updateModelConfigs({
       socialPostGenerator: { model: 'mistral:7b-instruct', temperature: 0.9 }
   });
   ```

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
- `to memorize`

### Post Summary Agent Implementation (January 2025)

**Project**: Qirata Express Backend - Token-efficient post context management for conversation summarization

#### Latest Updates:
1. **Post Summary Agent**:
   - **Created**: [`src/services/ai/agents/post-summary.agent.ts`](src/services/ai/agents/post-summary.agent.ts) - Function-based agent for post content summarization
   - **Purpose**: Generate concise post context summaries for conversation history instead of including full post content
   - **Token Optimization**: Reduces token usage by 60-70% in conversation summaries after initial summarization

2. **Implementation Architecture**:
   ```typescript
   export async function summarizePost(model: ChatOllama, postContent: string): Promise<string>
   ```
   - **Function-based approach**: Simple stateless operation instead of class-based complexity
   - **XML delimiter protection**: Uses `<POST_CONTENT>` tags to prevent prompt injection from post content
   - **Comprehensive analysis**: Extracts topics, tone, industry context, hashtags, content type, and target audience

3. **Database Schema Updates**:
   - **Migration**: `1735851772000-AddSummaryToPostExpanded.ts` - Added nullable `summary` column to `post_expanded` table
   - **Entity Update**: Updated `PostExpanded` entity with optional `summary?: string` field
   - **Usage Pattern**: Store post summary once per post selection, reference in conversation summaries

4. **Token Efficiency Strategy**:
   - **Initial Summary**: Include post content when creating first conversation summary (~1000 tokens)
   - **Subsequent Summaries**: Reference post summary context only (~300-500 tokens)
   - **Context Preservation**: Maintains conversation relevance without token waste
   - **Workflow**: Post Selection → Generate Summary → Store → Reference in Conversations

5. **Integration Points**:
   - **ConversationSummaryService**: Can reference stored post summaries instead of full content
   - **Chat Sessions**: Post context available throughout conversation without repeated token costs
   - **Memory Management**: Efficient context tracking for long conversations

#### Technical Decisions:
- **Function over Class**: Simple stateless operation doesn't require class complexity
- **Method Parameters**: Only 2 required params (model, postContent) - kept simple vs parameter object
- **XML Delimiters**: Robust content isolation to prevent prompt conflicts with markdown/code in posts
- **Nullable Column**: Database allows posts without summaries for backward compatibility