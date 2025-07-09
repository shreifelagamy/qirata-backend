# System Patterns - Qirata Express Backend

## Architecture Overview

### High-Level System Design

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   WebSocket     │    │   AI Services   │
│   Client        │◄──►│   Gateway       │◄──►│   (LangGraph)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Content       │    │   Express       │    │   Database      │
│   Aggregation   │◄──►│   REST API      │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Core System Components

#### 1. Content Management Layer
**Purpose**: Aggregate and manage reading sources and posts
- **RSS Service**: Fetch and parse RSS feeds from multiple sources
- **Content Scraper**: Extract full content from post links
- **Post Management**: CRUD operations for posts and reading status
- **Link Management**: Manage RSS feeds and content sources

#### 2. AI Orchestration Layer
**Purpose**: Provide intelligent content analysis and social post generation
- **LangGraph Workflow**: State-based AI processing with modular nodes
- **LangChain Fallback**: Legacy service for compatibility
- **Agent Functions**: Specialized AI agents for different tasks
- **Model Configuration**: Centralized AI model management

#### 3. Real-Time Communication Layer
**Purpose**: Enable real-time AI streaming and user interaction
- **WebSocket Service**: Socket.IO-based real-time communication
- **Session Management**: Per-user session tracking and state management
- **Stream Controllers**: Manage AI response streaming and cancellation
- **Event Routing**: Route different types of user interactions

#### 4. Data Persistence Layer
**Purpose**: Store and retrieve application data efficiently
- **TypeORM Integration**: Object-relational mapping for database operations
- **Entity Management**: Structured data models for all domain objects
- **Migration System**: Version-controlled database schema evolution
- **Query Optimization**: Efficient data retrieval patterns

## Key Technical Decisions

### 1. Modular AI Architecture (LangGraph)
**Decision**: Implement workflow-based AI processing using LangGraph
**Rationale**: 
- Separates concerns into specialized nodes
- Enables complex routing logic
- Supports streaming responses
- Allows independent testing of components

**Implementation Pattern**:
```typescript
// Node-based processing
interface BaseNode {
  execute(state: WorkflowState): Promise<Partial<WorkflowState>>;
}

// Workflow construction
class WorkflowBuilder {
  buildChatWorkflow(): StateGraph<WorkflowState>;
}
```

### 2. Dual-Service AI Strategy
**Decision**: Maintain both LangGraph and LangChain services
**Rationale**:
- LangGraph for new features and complex workflows
- LangChain for legacy compatibility and simple operations
- Gradual migration path without breaking existing functionality

### 3. Function-Based Agent Pattern
**Decision**: Implement AI agents as functions rather than classes
**Rationale**:
- Stateless operations don't require class complexity
- Easier testing and composition
- Clear separation of concerns
- Efficient memory usage

**Implementation Pattern**:
```typescript
export async function detectIntent(
  model: ChatOllama, 
  messages: Message[]
): Promise<IntentDetectionResult> {
  // Function-based agent implementation
}
```

### 4. Session-Based Stream Management
**Decision**: Implement per-session stream cancellation
**Rationale**:
- Prevents resource waste from abandoned requests
- Enables user interruption of long-running operations
- Supports concurrent user sessions
- Provides graceful cleanup

**Implementation Pattern**:
```typescript
private activeStreams = new Map<string, AbortController>();

cancelStream(sessionId: string): void {
  const controller = this.activeStreams.get(sessionId);
  if (controller) {
    controller.abort();
    this.activeStreams.delete(sessionId);
  }
}
```

## Design Patterns

### 1. Agent Pattern for AI Services
**Pattern**: Function-based agents for specific AI tasks
**Usage**: Intent detection, platform detection, content generation, summarization
**Benefits**:
- Clear separation of responsibilities
- Easy testing and mocking
- Stateless operations
- Composable functionality

### 2. Builder Pattern for Workflow Construction
**Pattern**: Centralized workflow construction
**Usage**: LangGraph workflow creation and configuration
**Benefits**:
- Consistent workflow setup
- Easy modification of processing flows
- Clear dependency management
- Reusable components

### 3. Repository Pattern for Data Access
**Pattern**: TypeORM entities with service layer abstraction
**Usage**: All database operations
**Benefits**:
- Clean separation of data access logic
- Easy testing with mocks
- Consistent query patterns
- Type-safe database operations

### 4. Observer Pattern for Real-Time Updates
**Pattern**: WebSocket event emission and listening
**Usage**: Real-time AI streaming and user notifications
**Benefits**:
- Loose coupling between components
- Real-time user experience
- Scalable event handling
- Easy addition of new event types

## Component Relationships

### Content Flow Architecture
```
RSS Sources → Content Aggregation → Database Storage
                     ↓
User Reading → AI Discussion → Response Generation
                     ↓
Social Sharing → Platform Optimization → Content Delivery
```

### AI Processing Flow
```
User Input → Intent Detection → Platform Detection → Content Generation
                                      ↓
                               Context Building → Model Selection → Streaming Response
```

### Session Management Flow
```
WebSocket Connection → Session Creation → State Management
                                ↓
                        Stream Processing → Response Delivery → Cleanup
```

## Critical Implementation Paths

### 1. Content Aggregation Path
**Flow**: RSS Feed → Content Parsing → Database Storage → User Access
**Key Components**:
- RSS Service (`src/services/content/rss.service.ts`)
- Content Scraper (`src/services/content/scraper.service.ts`)
- Post Entity (`src/entities/post.entity.ts`)
- Posts Controller (`src/controllers/posts.controller.ts`)

### 2. AI Processing Path
**Flow**: User Message → AI Orchestration → Response Generation → Stream Delivery
**Key Components**:
- LangGraph Chat Service (`src/services/ai/langgraph-chat.service.ts`)
- AI Agents (`src/services/ai/agents/`)
- WebSocket Controller (`src/controllers/websocket/chat.controller.ts`)
- Stream Management (`src/websocket/socket.service.ts`)

### 3. Social Post Generation Path
**Flow**: Content Selection → AI Analysis → Platform Optimization → Social Post Creation
**Key Components**:
- Social Post Generator Agent (`src/services/ai/agents/social-post-generator.agent.ts`)
- Platform Detection Agent (`src/services/ai/agents/platform-detection.agent.ts`)
- Social Post Entity (`src/entities/social-post.entity.ts`)
- Content Generation Workflow (LangGraph nodes)

### 4. User Preference Management Path
**Flow**: User Interaction → Pattern Extraction → Preference Storage → Context Application
**Key Components**:
- Pattern Extraction Service (`src/services/ai/pattern-extraction.service.ts`)
- Settings Entity (`src/entities/settings.entity.ts`)
- Memory Service (`src/services/ai/memory.service.ts`)
- Context Building in AI workflows

## Security and Performance Patterns

### 1. Input Validation Pattern
**Implementation**: Zod schemas for structured data validation
**Usage**: API endpoints, AI agent outputs, WebSocket messages
**Benefits**: Type safety, runtime validation, error prevention

### 2. Rate Limiting Pattern
**Implementation**: Express rate limiting middleware
**Usage**: API endpoints protection
**Benefits**: Prevent abuse, ensure fair usage, system stability

### 3. Stream Cancellation Pattern
**Implementation**: AbortController integration
**Usage**: Long-running AI operations
**Benefits**: Resource cleanup, user control, system responsiveness

### 4. Token Efficiency Pattern
**Implementation**: Post summarization for conversation context
**Usage**: Conversation history management
**Benefits**: Reduced API costs, improved performance, maintained context

## Extensibility Patterns

### 1. Plugin Architecture for Content Sources
**Pattern**: Modular content source integration
**Future**: Support for additional content source types
**Implementation**: Interface-based source adapters

### 2. Agent Composition Pattern
**Pattern**: Chainable AI agents for complex operations
**Future**: Multi-step AI processing workflows
**Implementation**: Function composition and state passing

### 3. Model Configuration Pattern
**Pattern**: Environment-based model selection
**Future**: Dynamic model switching and A/B testing
**Implementation**: Centralized model configuration service

### 4. Middleware Pattern for Processing Pipeline
**Pattern**: Composable request/response processing
**Future**: Custom processing steps and integrations
**Implementation**: Express middleware pattern extended to AI workflows