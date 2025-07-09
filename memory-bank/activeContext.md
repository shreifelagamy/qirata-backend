# Active Context - Qirata Express Backend

## Current Development Focus

### Primary Development Areas (January 2025)

#### 1. Token-Efficient Context Management
**Current Priority**: Post Summary Agent Implementation
- **Status**: Recently completed post summary agent for token optimization
- **Location**: `src/services/ai/agents/post-summary.agent.ts`
- **Purpose**: Generate concise post summaries for conversation context instead of full content
- **Impact**: 60-70% reduction in token usage for conversation summaries

#### 2. Centralized Model Configuration System
**Current Priority**: Per-service model optimization
- **Status**: Implemented centralized model configuration for LangGraph workflows
- **Key Features**:
  - Environment-based model selection per AI service
  - Runtime model configuration updates
  - Specialized model configurations for different tasks
  - Graceful fallback mechanisms

#### 3. Modular LangGraph Architecture
**Current Priority**: Maintaining and extending modular node system
- **Status**: Completed refactoring to modular architecture
- **Key Components**:
  - Individual node files for each AI operation
  - Centralized workflow builder
  - Separated routing logic
  - Base node pattern for common functionality

## Recent Changes & Implementation Notes

### Latest Implementations

#### Post Summary Agent (January 2025)
**Implementation Approach**: Function-based agent for simplicity
```typescript
export async function summarizePost(model: ChatOllama, postContent: string): Promise<string>
```

**Key Technical Decisions**:
- **Function over Class**: Simple stateless operation doesn't need class complexity
- **XML Delimiters**: Uses `<POST_CONTENT>` tags to prevent prompt injection
- **Database Integration**: Added nullable `summary` column to `post_expanded` table
- **Token Strategy**: Store summary once, reference in multiple conversations

#### Centralized Model Configuration (December 2024)
**Implementation Pattern**: Environment-driven model selection
```typescript
interface WorkflowModelConfigs {
    intentDetection: ModelConfig;
    platformDetection: ModelConfig;
    questionHandler: ModelConfig;
    socialPostGenerator: ModelConfig;
    memoryService: ModelConfig;
}
```

**Key Environment Variables**:
- `INTENT_MODEL=llama3:8b` - Fast classification
- `PLATFORM_MODEL=mistral:7b-instruct` - Deterministic detection
- `QUESTION_MODEL=mistral:7b` - Balanced Q&A
- `SOCIAL_POST_MODEL=mistral:7b` - Creative content
- `MEMORY_MODEL=llama3:8b` - Efficient summarization

### AI Platform Detection Enhancement (December 2024)
**Key Improvements**:
- **Replaced Keyword Matching**: Migrated to AI-based analysis
- **Zod Schema Validation**: Structured output parsing for type safety
- **Conservative Detection**: Only explicit platform mentions, no inference
- **Multi-language Support**: Arabic platform names support

## Current Architecture Patterns

### AI Service Architecture
**Pattern**: Function-based agents with centralized workflow orchestration
- **Agents**: Stateless functions for specific AI tasks
- **Workflows**: LangGraph state machines for complex operations
- **Models**: Per-service model configuration with environment overrides
- **Streaming**: Real-time response delivery via WebSocket

### Content Management Architecture
**Pattern**: Aggregation-first with AI-enhanced understanding
- **RSS Integration**: Multi-source content aggregation
- **Content Processing**: HTML parsing and markdown conversion
- **Reading Management**: Status tracking and organization
- **AI Discussion**: Context-aware post analysis and Q&A

### Database Architecture
**Pattern**: Entity-based design with migration system
- **Entities**: TypeORM entities for all domain objects
- **Migrations**: Version-controlled schema evolution
- **Relationships**: Proper foreign key relationships
- **Optimization**: Efficient queries and indexing

## Active Development Considerations

### Current Technical Debt
1. **Legacy LangChain Service**: Maintain compatibility while favoring LangGraph
2. **Type Safety**: Ensure all new AI integrations use Zod validation
3. **Error Handling**: Comprehensive error handling for AI operations
4. **Testing**: Maintain test coverage for AI services

### Performance Optimizations
1. **Token Efficiency**: Continue optimizing AI token usage
2. **Stream Management**: Efficient WebSocket connection handling
3. **Database Queries**: Optimize content retrieval patterns
4. **Memory Usage**: Efficient conversation context management

### Development Patterns to Follow

#### AI Agent Development
```typescript
// Preferred pattern for new AI agents
export async function agentFunction(
    model: ChatOllama, 
    input: InputType
): Promise<OutputType> {
    // Use XML delimiters for content isolation
    // Implement Zod validation for outputs
    // Include comprehensive error handling
}
```

#### Database Entity Updates
```typescript
// Pattern for entity modifications
// 1. Create migration file
// 2. Update entity class
// 3. Update DTOs and validation
// 4. Update service layer
// 5. Update API endpoints
```

#### WebSocket Event Handling
```typescript
// Pattern for new WebSocket events
// 1. Define event types in socket.types.ts
// 2. Implement handler in chat.controller.ts
// 3. Update client-side event handling
// 4. Add error handling and logging
```

## Next Steps & Immediate Priorities

### Short-Term Goals (Next 2-4 weeks)
1. **Content Aggregation Enhancement**: Improve RSS feed processing reliability
2. **AI Model Optimization**: Fine-tune model selection for different content types
3. **User Experience**: Enhance WebSocket connection stability
4. **Testing**: Expand test coverage for AI services

### Medium-Term Goals (Next 1-2 months)
1. **Advanced Content Processing**: Implement content categorization
2. **Social Media Integration**: Direct platform posting capabilities
3. **User Analytics**: Reading pattern analysis and recommendations
4. **Performance Monitoring**: Advanced logging and metrics

### Long-Term Vision (Next 3-6 months)
1. **Multi-User Support**: Team collaboration features
2. **Advanced AI Features**: Content recommendations and insights
3. **Mobile API**: Optimized endpoints for mobile applications
4. **Enterprise Features**: Advanced user management and analytics

## Key Learnings & Insights

### AI Integration Learnings
- **Function-based agents** are more maintainable than class-based for simple operations
- **Zod validation** is essential for reliable AI output parsing
- **Token efficiency** significantly impacts performance and cost
- **Model specialization** improves accuracy for specific tasks

### Architecture Learnings
- **Modular design** enables easier testing and maintenance
- **Environment-based configuration** provides deployment flexibility
- **Stream cancellation** is crucial for user experience
- **Database migrations** must be carefully planned and tested

### Performance Learnings
- **Post summarization** dramatically reduces token usage
- **WebSocket connection management** is critical for scalability
- **Database query optimization** impacts response times
- **Memory management** is important for long-running sessions

## Development Environment Setup

### Required Services
- **PostgreSQL**: Database server
- **Ollama**: AI model hosting service
- **Node.js**: Runtime environment
- **TypeScript**: Development language

### Key Development Commands
```bash
# Start development server
npm run dev

# Database migrations
npm run migration:run

# AI service health check
npm run ai:health-check

# Build for production
npm run build
```

### Testing Strategy
- **Unit Tests**: Individual service and function testing
- **Integration Tests**: End-to-end workflow testing
- **AI Tests**: Specialized AI service testing
- **Performance Tests**: Load testing for WebSocket streams

## Important Implementation Notes

### Code Quality Standards
- **TypeScript Strict Mode**: All code must pass strict type checking
- **Zod Validation**: All AI outputs must use Zod schema validation
- **Error Handling**: Comprehensive error handling with proper logging
- **Documentation**: All public APIs must have proper documentation

### Security Considerations
- **Input Sanitization**: All user inputs must be sanitized
- **Rate Limiting**: API endpoints must have appropriate rate limits
- **Authentication**: All WebSocket connections must be authenticated
- **Data Validation**: All data must be validated before processing

### Performance Requirements
- **Response Time**: API responses should be under 200ms
- **Stream Latency**: WebSocket streams should start within 100ms
- **Memory Usage**: Efficient memory management for long-running processes
- **Database Performance**: Optimized queries with proper indexing