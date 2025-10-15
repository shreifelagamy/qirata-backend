# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Essential Development
```bash
# Start development server with hot-reload
npm run dev

# Start with AI services (requires Ollama)
npm run dev:ai

# Type checking (watch mode)
npm run typecheck:watch

# Type checking (single run)
npm run typecheck

# Build for production
npm run build

# Start production server
npm start
```

### Database Operations
```bash
# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Generate new migration (after entity changes)
npm run migration:generate -- -n MigrationName

# IMPORTANT: NEVER manually modify database schema
# ALWAYS use TypeORM migrations for schema changes
```

### AI Service Commands
```bash
# Check AI service health
npm run ai:health-check

# Test AI integration
npm run ai:test

# Check Ollama status
npm run ollama:check

# Full setup (install + migrate + health check)
npm run setup:full
```

### Testing & Quality
```bash
# Run AI-specific tests
npm run test:ai
```

## Architecture Overview

### Core System Architecture

This is a TypeScript Express.js backend with real-time WebSocket capabilities, AI-powered content analysis, and social media post generation. The system uses **LangGraph** for AI workflow orchestration with state-based processing.

**Key Technology Stack:**
- **Backend Framework**: Express.js + TypeScript
- **Database**: PostgreSQL + TypeORM
- **Real-time**: Socket.IO for WebSocket communication
- **AI Orchestration**: LangGraph with LangChain
- **AI Models**: Ollama (local) and OpenAI (configurable)
- **Authentication**: Better-Auth with JWT
- **API Documentation**: Swagger/OpenAPI (dev only)

### High-Level System Flow

```
RSS/Content Sources → Content Aggregation → Database Storage
                                                    ↓
User Reads Content → WebSocket Chat → AI Processing (LangGraph)
                                                    ↓
                     Intent Detection → Platform Detection → Response Generation
                                                    ↓
                     Social Post Creation ← Streaming Response → User Interface
```

### Project Structure

```
src/
├── app.ts                        # Main application entry point
├── config/                       # Configuration files (auth, swagger, models)
├── controllers/                  # HTTP request handlers (thin layer)
│   └── websocket/               # WebSocket-specific controllers
├── dtos/                        # Data Transfer Objects with validation
├── entities/                    # TypeORM database entities
├── middleware/                  # Express middleware (auth, validation, rate limit)
├── routes/                      # API route definitions
├── services/                    # Business logic layer
│   ├── ai/                      # AI services and LangGraph implementation
│   │   ├── langgraph/          # LangGraph workflow architecture
│   │   │   ├── nodes/          # Workflow processing nodes
│   │   │   ├── routers/        # Conditional routing logic
│   │   │   └── builders/       # Workflow construction
│   │   ├── tasks/              # Specialized AI task handlers
│   │   ├── pattern-extraction.service.ts
│   │   └── langgraph-chat.service.ts
│   └── content/                # RSS and content scraping services
├── types/                      # TypeScript type definitions
├── websocket/                  # Socket.IO implementation
└── utils/                      # Utility functions and helpers
```

## Critical Implementation Patterns

### 1. **LangGraph AI Workflow Architecture**

The AI system uses a **node-based workflow** with state management:

**Workflow Nodes:**
- `IntentDetectionNode` - Classifies user intent (social post vs conversation)
- `PlatformDetectionNode` - Identifies target platform (Twitter, LinkedIn, etc.)
- `PlatformClarificationNode` - Handles ambiguous platform requests
- `QuestionHandlerNode` - Processes Q&A about content
- `SocialPostGeneratorNode` - Creates structured social media posts
- `ConversationSummaryNode` - Generates session summaries

**Routing Logic:**
- `IntentRouter` - Routes based on detected intent type
- `PlatformRouter` - Routes based on platform detection confidence

**Key Files:**
- `src/services/ai/langgraph-chat.service.ts` - Main orchestration service
- `src/services/ai/langgraph/builders/workflow-builder.ts` - Graph construction
- `src/services/ai/langgraph/nodes/` - Individual processing nodes

### 2. **API Response Standards**

**CRITICAL: All successful API responses MUST use this format:**
```typescript
{
  "data": { /* actual response data */ },
  "status": 200
}
```

**Error responses:**
```typescript
{
  "message": "Error description",
  "status": 400,
  "errors": { "field": ["validation error"] },  // optional
  "data": { /* additional context */ }          // optional
}
```

**Implementation Rule:**
- Never use `res.json(responseData)` directly
- Always wrap: `res.json({ data: responseData, status: statusCode })`

### 3. **WebSocket Real-Time Communication**

**Architecture:**
- Socket.IO integration with Express HTTP server
- Event-based routing through `WebSocketRouter`
- Authentication middleware for secure connections
- Streaming AI responses with token-by-token delivery

**Key Events:**
- `chat:message` - User sends message
- `chat:stream:start` - AI response starts
- `chat:stream:token` - Real-time token delivery
- `chat:stream:end` - Response complete
- `chat:social:generated` - Social post created
- `chat:interrupt` - Cancel active stream

**Stream Management:**
- Per-session `AbortController` for cancellation
- Active stream tracking with cleanup
- Resource management and graceful shutdown

**Key Files:**
- `src/websocket/socket.service.ts` - Connection management
- `src/controllers/websocket/chat.controller.ts` - Chat handling
- `src/websocket/handlers/chat.handler.ts` - Event handlers

### 4. **Database Patterns with TypeORM**

**Entity Conventions:**
- All entities extend `BaseEntity` with UUID primary keys
- Timestamps: `createdAt`, `updatedAt` with automatic management
- Use decorators: `@Entity()`, `@Column()`, `@OneToMany()`, etc.

**Key Relationships:**
- `ChatSession` → `Message` (one-to-many)
- `ChatSession` → `SocialPost` (one-to-many)
- `ChatSession` → `Post` (many-to-one, optional)
- `Post` → `PostExpanded` (one-to-one)

**Migration Rules:**
- **NEVER manually modify database schema**
- **ALWAYS use TypeORM migrations** for schema changes
- Create: `npx typeorm migration:create src/database/migrations/MigrationName`
- Run: `npm run migration:run`
- Revert: `npm run migration:revert`

### 5. **Session and Context Management**

**Session Caching:**
- In-memory cache with 1-hour TTL
- Reduces database queries for active sessions
- Automatic cache invalidation and refresh
- Cache-first read pattern, write-through on updates

**AI Context Building:**
- Post content from cached session
- Last 10 messages for conversation history
- Conversation summary (if available)
- User preferences (tone, platform, length)

**Implementation:**
```typescript
// In ChatSessionService
private sessionCache = new Map<string, {
  chatSession: ChatSession,
  cacheAt: Date
}>();
```

### 6. **Intent-Based Response Generation**

The system automatically detects user intent and routes accordingly:

**Social Post Intent Keywords:**
- create, write, generate, post, tweet
- compose, draft, publish, share, social

**Platform Keywords:**
- Twitter: tweet, twitter, x
- LinkedIn: linkedin, professional
- General: post, social media

**Response Flow:**
1. User message → Intent detection
2. If social post → Platform detection → Post generation
3. If question → Context retrieval → Answer generation
4. Stream response → Save to database → Update cache

### 7. **Content Aggregation System**

**RSS Feed Processing:**
- Multiple source support via `Link` entities
- Automated feed parsing and content extraction
- Full article scraping with fallback strategies
- Read status tracking per user

**Services:**
- `RssService` - Feed parsing and item extraction
- `ScraperService` - Web content extraction
- `ContentAggregationService` - Orchestration

### 8. **User Preferences and Pattern Learning**

**Style Wizard:**
- 4 pre-defined profiles: data_analyst, thought_leader, community_builder, storyteller
- Dynamic preference management (voice, tone, platform, length)
- Persistence using `Settings` entity

**Pattern Extraction:**
- Automatic learning from user interactions
- Request pattern detection (length adjustments, emoji usage)
- Vocabulary analysis (formality, technical language)
- Platform behavior tracking

**Key Files:**
- `src/services/ai/pattern-extraction.service.ts`
- Preferences stored in `settings` table as JSON

## Environment Configuration

**Required Variables:**
```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=qirata
DB_USERNAME=postgres
DB_PASSWORD=your_password

# AI Services
OLLAMA_BASE_URL=http://localhost:11434
OPENAI_API_KEY=your_key  # Optional

# Authentication
JWT_SECRET=your_secret
```

See `.env.production.example` for production configuration.

## Middleware Stack

**Order Matters:**
1. CORS (with credentials support)
2. Better-Auth routes (`/api/auth/*`)
3. JSON/URL-encoded body parsing
4. Static file serving
5. Morgan logging (dev/production modes)
6. Helmet security headers (lazy-loaded)
7. API routes (`/api/v1/*`)
8. Error handling middleware

## Swagger Documentation

Available at `/api-docs` in development mode only.

**Auto-generated from:**
- Route definitions with JSDoc comments
- Entity schemas
- DTO validation rules

**Update when:**
- Adding/modifying endpoints
- Changing request/response schemas
- Updating authentication requirements

## Testing Strategy

**Test Categories:**
- Unit tests: AI agents, pattern extraction, preferences
- Integration tests: Workflow coordination, end-to-end flows
- AI streaming tests: WebSocket communication, token delivery

**No test files currently exist in `src/` - tests should be added in:**
- `src/__tests__/` or `tests/` directory
- Follow naming: `*.test.ts` or `*.spec.ts`

## Deployment Considerations

**Production Build:**
1. `npm run build` - Compiles TypeScript to `dist/`
2. `npm run migration:run` - Apply pending migrations
3. `npm start` - Run from compiled code

**PM2 Configuration:**
- Cluster mode recommended for horizontal scaling
- See `README.md` for ecosystem.config.js example

**Nginx Setup:**
- Proxy HTTP to Express port (3000)
- Proxy WebSocket to Socket.IO with upgrade headers
- See `README.md` for configuration example

## Important Rules from CLAUDE.md

1. **Backend-only application** - No frontend work in this repo
2. **Always update Swagger documentation** when APIs change
3. **Database migrations only** - Never manually modify schema
4. **Standardized API responses** - Always wrap in `{ data, status }` format
5. **Type safety everywhere** - Strong TypeScript typing required
6. **Separation of concerns** - Controllers (HTTP) → Services (logic) → Entities (data)

## Common Development Tasks

### Adding a New AI Workflow Node

1. Create node in `src/services/ai/langgraph/nodes/`
2. Extend `BaseNode` abstract class
3. Implement `execute(state: ChatState)` method
4. Register in `workflow-builder.ts`
5. Update routing logic if needed

### Adding a New API Endpoint

1. Define entity in `src/entities/` (if new resource)
2. Create DTO in `src/dtos/` with validation
3. Implement service in `src/services/`
4. Create controller in `src/controllers/`
5. Define routes in `src/routes/`
6. Register routes in `src/routes/index.ts`
7. Update Swagger documentation
8. Test the endpoint

### Adding WebSocket Events

1. Define event in `src/websocket/handlers/`
2. Add to `WebSocketRouter` registration
3. Document in `docs/API.md`
4. Update Socket.IO types in `src/types/socket.types.ts`

### Database Schema Changes

1. Modify entity in `src/entities/`
2. Generate migration: `npm run typeorm migration:generate -- -n DescriptiveName`
3. Review generated migration in `src/database/migrations/`
4. Test: `npm run migration:run`
5. If issues: `npm run migration:revert` and fix

## Documentation References

- **API Documentation**: `docs/API.md` - Complete endpoint reference
- **Setup Guide**: `docs/SETUP.md` - Environment setup and troubleshooting
- **WebSocket Architecture**: `docs/WEBSOCKET_ARCHITECTURE_FLOW.md` - Flow diagrams
- **AI Integration**: `AI_INTEGRATION_SUMMARY.md` - AI features and implementation
- **System Patterns**: `memory-bank/systemPatterns.md` - Architecture patterns
- **Implementation Rules**: `docs/AI_AGENT_IMPLEMENTATION_RULES.md` - Coding standards

## Troubleshooting

**Database Connection Issues:**
```bash
# Check PostgreSQL is running
pg_isready

# Verify connection details
echo $DB_HOST $DB_PORT $DB_DATABASE
```

**AI Service Issues:**
```bash
# Check Ollama status
npm run ollama:check

# Run health check
npm run ai:health-check
```

**WebSocket Connection Issues:**
- Verify Socket.IO client version compatibility
- Check authentication token is valid
- Ensure CORS settings include WebSocket origin

**Build Errors:**
```bash
# Clean build directory
rm -rf dist/

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```
