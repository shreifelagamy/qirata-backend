# Qirata Express Backend Architecture

## Project Context
- **Backend-only application** - No frontend work required
- **Always update Swagger documentation** when APIs are modified
- Focus only on backend implementation and API documentation updates

## Backend Architecture

### 1. Overall Application Structure

**Main Entry Point**: `/src/app.ts`
- Express.js application with TypeScript
- HTTP server with Socket.IO WebSocket integration
- PostgreSQL database with TypeORM
- Swagger API documentation (development only)
- Comprehensive middleware stack

**Key Configuration Files**:
- `package.json` - Dependencies and scripts including LangChain, Socket.IO, TypeORM
- `tsconfig.json` - TypeScript configuration with decorators enabled
- `/src/config/swagger.config.ts` - Comprehensive OpenAPI 3.0 documentation setup

### 2. Database Layer (TypeORM + PostgreSQL)

**Database Setup**:
- Connection configured in `app.ts` with environment variables
- Custom database file logger (`/src/utils/database-logger.ts`)
- Auto-synchronization in development mode

**Core Entities** (`/src/entities/`):
- `BaseEntity` - UUID primary keys with timestamps
- `Link` - RSS feed sources and external content links
- `Post` - Content items from feeds with read status tracking
- `PostExpanded` - AI-enhanced content versions
- `ChatSession` - Conversation containers with optional post associations
- `Message` - Chat history with type differentiation (MESSAGE/SOCIAL_POST)
- `SocialPost` - Platform-specific social media content with structured data
- `Settings` - Key-value configuration storage

**Repositories** (`/src/repositories/`):

**Key Relationships**:
- ChatSession → Messages (one-to-many)
- ChatSession → SocialPosts (one-to-many)
- ChatSession → Post (optional many-to-one)
- Post → PostExpanded (one-to-one)

**Migration System**:
- Located in `/src/database/migrations/`
- Schema evolution tracking from basic tables to structured social content
- Recent migrations add summary fields and structured content support

### 3. API Layer (Express.js + Swagger)

**Routing Structure** (`/src/routes/`):
- `index.ts` - Main router factory with global middleware
- `chat-session.routes.ts` - Chat session management
- `links.routes.ts` - RSS feed and link management
- `posts.routes.ts` - Content post operations
- `settings.routes.ts` - Configuration management
- `websocket.routes.ts` - WebSocket event definitions

**API Versioning**: All routes mounted under `/api/v1`

**Controllers** (`/src/controllers/`):
- RESTful controllers for each entity type
- `websocket/chat.controller.ts` - Unified chat and social post generation

**Middleware Stack** (`/src/middleware/`):
- `error.middleware.ts` - Global error handling with HttpError class
- `rateLimit.middleware.ts` - API rate limiting
- `validation.middleware.ts` - Request validation
- `websocket.middleware.ts` - WebSocket authentication

**Swagger Documentation**:
- Comprehensive OpenAPI 3.0 schemas in `swagger.config.ts`
- Auto-generated docs at `/api-docs` (development)
- Complete entity schemas, DTOs, and error responses

### 4. AI/LangGraph Integration Architecture

**Core AI Service**: `/src/services/ai/langgraph-chat.service.ts`
- Singleton service managing AI workflow orchestration
- Request cancellation and session management
- Graph visualization generation for LangGraph Studio

**LangGraph Workflow Architecture** (`/src/services/ai/langgraph/`):

**Workflow Builder** (`/builders/workflow-builder.ts`):
- StateGraph construction with ChatStateAnnotation
- Model injection and node orchestration
- Conditional routing between intent detection and response generation

**Node Architecture** (`/nodes/`):
- `BaseNode` - Abstract base class with logging and error handling
- `IntentDetectionNode` - Classifies user intent (social vs conversation)
- `PlatformDetectionNode` - Identifies target social platform
- `PlatformClarificationNode` - Handles platform ambiguity
- `QuestionHandlerNode` - Processes Q&A interactions
- `SocialPostGeneratorNode` - Creates structured social content
- `ConversationSummaryNode` - Generates session summaries

**Routing Logic** (`/routers/`):
- `IntentRouter` - Routes based on detected user intent
- `PlatformRouter` - Routes based on platform detection results

**AI Agents** (`/agents/`):
- Specialized agents for specific AI tasks
- Intent detection with Zod schema validation
- Platform detection with confidence scoring
- Social post generation with structured output
- Question handling with context awareness

**State Management**:
- `ChatState` interface defining workflow state
- Context propagation through workflow nodes
- Memory management with MemorySaver

### 5. WebSocket Implementation (Socket.IO)

**Socket Service** (`/src/websocket/socket.service.ts`):
- Connection management with authentication
- Active connection tracking
- Event routing through WebSocketRouter
- Health monitoring (ping/pong)

**Authentication Middleware**:
- Token-based authentication (placeholder for JWT)
- User ID extraction and socket data setup
- Connection lifecycle management

**Chat Controller** (`/controllers/websocket/chat.controller.ts`):
- Unified message handling for Q&A and social posts
- Real-time streaming with callback management
- Intent-based response routing
- Stream interruption and cleanup

**Event Handling**:
- Auto-registration of events from route definitions
- Structured event data with type safety
- Error handling and recovery

### 6. Services & Business Logic

**Core Services** (`/src/services/`):
- `ChatSessionService` - Session management and AI context building
- `MessagesService` - Message persistence with type differentiation
- `SocialPostsService` - Social media content management with upsert logic
- `PostsService` - Content management with read tracking
- `LinksService` - RSS feed source management
- `SettingsService` - Configuration management

**Content Services** (`/services/content/`):
- `ContentAggregationService` - Feed processing coordination
- `RssService` - RSS feed parsing and content extraction
- `ScraperService` - Web content extraction
- `AgentQlService` - Advanced web scraping capabilities

**AI Supporting Services**:
- `MemoryService` - Conversation memory management
- `PatternExtractionService` - User preference analysis

### 7. Type System & Data Validation

**Type Definitions** (`/src/types/`):
- `ai.types.ts` - AI service interfaces, callbacks, and responses
- `socket.types.ts` - WebSocket event and authentication types
- `model-config.types.ts` - AI model configuration types
- `content.types.ts` - Content processing types

**DTOs** (`/src/dtos/`):
- Request/response validation with class-validator
- Entity-specific data transfer objects
- Swagger schema integration

### 8. Key Technical Patterns

**Error Handling**:
- Global error middleware with structured responses
- Custom HttpError class for API errors
- Comprehensive logging with Winston
- Development vs production error detail levels

**Database Patterns**:
- Repository pattern through TypeORM
- UUID-based entity identification
- Timestamp tracking on base entities
- JSON/JSONB for complex data structures (social post structured content)

**Authentication & Authorization**:
- WebSocket authentication middleware
- Bearer token support (JWT placeholder)
- User context propagation through socket data

**AI Integration Patterns**:
- Workflow orchestration with LangGraph
- Streaming responses with callback handling
- Intent-based routing and response generation
- Memory management across chat sessions
- Model configuration abstraction

**Real-time Communication**:
- Event-driven architecture with Socket.IO
- Stream state management and cleanup
- Connection lifecycle handling
- Room-based message delivery

**Configuration Management**:
- Environment-based configuration
- Model configuration with fallbacks
- Runtime configuration updates
- Settings persistence and retrieval

### 9. Development & Deployment

**Scripts** (package.json):
- Development server with nodemon and ts-node
- AI health checking and testing utilities
- Database migration management
- Ollama integration scripts

**Database Migration Guidelines**:
- **ALWAYS use TypeORM commands for database schema changes**
- **NEVER manually modify database schema** - use migrations for all changes
- **Migration Creation**: Use `npx typeorm migration:create src/database/migrations/MigrationName`
- **Migration Execution**: Use `npm run migration:run` to apply pending migrations
- **Migration Rollback**: Use `npm run migration:revert` to undo last migration
- All migrations located in `/src/database/migrations/` with timestamp prefixes
- Follow existing migration patterns for consistency

**Logging & Monitoring**:
- Winston-based logging system
- Database query logging in development
- Request/response logging with Morgan
- AI workflow visualization for debugging

**API Documentation**:
- Live Swagger UI in development
- Comprehensive schema definitions
- Request/response examples
- Authentication flow documentation

**API Response Standards**:
- **CRITICAL: All successful API responses MUST follow the standardized format**:
  ```json
  {
    "data": { /* actual response data */ },
    "status": 200 /* HTTP status code */
  }
  ```
- **Error responses** follow the frontend error type structure:
  ```json
  {
    "message": "Error description",
    "status": 400,
    "errors": { "field": ["validation error"] }, // optional validation errors
    "data": { "timestamp": "...", "path": "...", "method": "..." } // optional additional data
  }
  ```
- **Implementation rule**: Every controller method returning success data MUST wrap the response in the `{ data: responseData, status: httpStatusCode }` structure
- **NO direct `res.json(responseData)` calls** - always use `res.json({ data: responseData, status: statusCode })`

This architecture provides a robust foundation for AI-powered content management with real-time capabilities, structured around TypeScript best practices and modern backend patterns.