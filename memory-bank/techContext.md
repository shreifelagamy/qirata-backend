# Technology Context - Qirata Express Backend

## Technology Stack Overview

### Core Technologies
- **Runtime**: Node.js with TypeScript (v5.0.4)
- **Framework**: Express.js (v4.18.2)
- **Database**: PostgreSQL with TypeORM (v0.3.16)
- **Real-Time**: Socket.IO (v4.6.1)
- **AI Integration**: LangChain (v0.3.27), LangGraph (v0.3.5), Ollama (v0.2.1)
- **Validation**: Zod (v3.25.42) for structured data validation
- **Testing**: Built-in testing framework with AI-specific test suites

### Development Environment
- **Package Manager**: npm with package-lock.json
- **Development Server**: nodemon with ts-node for hot reloading
- **Build System**: TypeScript compiler (tsc)
- **Code Quality**: Strict TypeScript configuration
- **Documentation**: Swagger/OpenAPI integration

## AI & Machine Learning Stack

### Primary AI Framework
**LangChain Ecosystem**:
- **LangChain Core**: Main AI orchestration framework
- **LangGraph**: State-based workflow management for complex AI operations
- **Ollama Integration**: Local AI model hosting and management

### AI Model Management
**Ollama Integration**:
- **Local Model Hosting**: Self-hosted AI models via Ollama
- **Model Configuration**: Environment-based model selection
- **Multi-Model Support**: Different models for different tasks (intent detection, content generation, summarization)

### AI Agent Architecture
**Function-Based Agents**:
```typescript
// Agent pattern for specialized AI tasks
export async function detectIntent(model: ChatOllama, messages: Message[]): Promise<IntentDetectionResult>
export async function generateSocialPost(model: ChatOllama, content: string, platform: string): Promise<string>
export async function summarizePost(model: ChatOllama, postContent: string): Promise<string>
```

## Database Architecture

### Database Technology
**PostgreSQL with TypeORM**:
- **ORM**: TypeORM for type-safe database operations
- **Migration System**: Version-controlled schema evolution
- **Connection Management**: Centralized database configuration
- **Query Optimization**: Efficient data retrieval patterns

### Key Database Entities
```typescript
// Core entities for content management
- Link (RSS feeds and content sources)
- Post (aggregated content)
- PostExpanded (detailed post information with summaries)
- ChatSession (user conversation sessions)
- Message (individual chat messages)
- SocialPost (generated social media content)
- Settings (user preferences and configuration)
```

### Migration Strategy
**Database Evolution**:
- Automated migration generation via TypeORM
- Version-controlled schema changes
- Rollback capabilities for deployments
- Data integrity preservation

## Real-Time Communication

### WebSocket Implementation
**Socket.IO Integration**:
- **Real-Time Streaming**: Token-by-token AI response delivery
- **Session Management**: Per-user session tracking
- **Event Routing**: Structured event handling for different interaction types
- **Connection Management**: Automatic reconnection and cleanup

### WebSocket Event Architecture
```typescript
// Event types for real-time communication
'chat:message'        // User message input
'chat:stream:start'   // AI response streaming begins
'chat:stream:token'   // Individual response tokens
'chat:stream:end'     // Response streaming complete
'chat:stream:error'   // Error handling
'chat:interrupt'      // User interruption
```

## Content Management Stack

### Content Aggregation
**RSS & Feed Processing**:
- **Feedparser**: RSS feed parsing and content extraction
- **Cheerio**: HTML parsing and content scraping
- **Axios**: HTTP client for content fetching
- **Sanitize-HTML**: Content sanitization and security

### Content Processing
**Text Processing**:
- **Turndown**: HTML to Markdown conversion
- **Content Extraction**: Full article content retrieval
- **Summarization**: AI-powered content summarization for token efficiency

## Security & Validation

### Input Validation
**Zod Schema Validation**:
- **Type Safety**: Runtime type checking for all inputs
- **API Validation**: Request/response validation
- **AI Output Validation**: Structured AI response parsing
- **Error Handling**: Comprehensive validation error management

### Security Middleware
**Express Security Stack**:
- **Helmet**: Security headers and protection
- **CORS**: Cross-origin resource sharing configuration
- **Rate Limiting**: API rate limiting and abuse prevention
- **Morgan**: HTTP request logging for monitoring

### Authentication & Authorization
**JWT Integration**:
- **Token Management**: JWT token handling
- **Session Security**: Secure session management
- **bcryptjs**: Password hashing and security

## Development Tools

### Development Workflow
**Development Environment**:
- **Hot Reloading**: nodemon + ts-node for rapid development
- **AI Health Checks**: Automated AI service health monitoring
- **Script Management**: Automated setup and testing scripts
- **Database Management**: Migration and seeding automation

### Testing Infrastructure
**Testing Framework**:
- **AI Testing**: Specialized test suites for AI services
- **Unit Testing**: Component-level testing
- **Integration Testing**: End-to-end workflow testing
- **Performance Testing**: Load testing for WebSocket streams

### Documentation & API
**API Documentation**:
- **Swagger Integration**: Comprehensive API documentation
- **Type Definitions**: Full TypeScript type coverage
- **Usage Examples**: Real-world API usage patterns

## Configuration Management

### Environment Configuration
**Environment Variables**:
```bash
# Database Configuration
DATABASE_URL=postgresql://...

# AI Model Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=mistral:7b

# Service-Specific Models
INTENT_MODEL=llama3:8b
PLATFORM_MODEL=mistral:7b-instruct
QUESTION_MODEL=mistral:7b
SOCIAL_POST_MODEL=mistral:7b
MEMORY_MODEL=llama3:8b

# Model Parameters
INTENT_TEMPERATURE=0.3
PLATFORM_TEMPERATURE=0.1
QUESTION_TEMPERATURE=0.7
SOCIAL_POST_TEMPERATURE=0.8
MEMORY_TEMPERATURE=0.5
```

### Model Configuration System
**Centralized Model Management**:
- **Per-Service Models**: Different models for different AI tasks
- **Environment-Based Selection**: Model selection via environment variables
- **Runtime Configuration**: Dynamic model switching capabilities
- **Fallback Mechanisms**: Graceful handling of unavailable models

## Performance & Scalability

### Performance Optimization
**Efficiency Patterns**:
- **Token Efficiency**: Post summarization to reduce API costs
- **Stream Management**: Efficient WebSocket connection handling
- **Database Optimization**: Optimized queries and indexing
- **Caching Strategy**: Service-level caching for frequently accessed data

### Scalability Considerations
**Horizontal Scaling**:
- **Stateless Architecture**: Session management for scalability
- **Database Connection Pooling**: Efficient connection management
- **WebSocket Scaling**: Per-instance WebSocket handling
- **Load Balancing Ready**: Architecture supports load balancing

## Development Constraints

### Technical Constraints
- **TypeScript Strict Mode**: Enforced type safety across the codebase
- **Database Migrations**: All schema changes must be versioned
- **AI Model Dependencies**: Requires Ollama service for AI functionality
- **Real-Time Requirements**: WebSocket connections must be maintained

### Integration Requirements
- **RSS Feed Compatibility**: Support for various RSS feed formats
- **Social Platform APIs**: Integration with social media platforms
- **AI Model Compatibility**: Support for different Ollama models
- **Frontend Integration**: RESTful API and WebSocket compatibility

## Monitoring & Logging

### Logging Infrastructure
**Winston Logging**:
- **Structured Logging**: JSON-formatted logs for analysis
- **Log Levels**: Debug, info, warn, error categorization
- **File Rotation**: Automated log file management
- **Performance Monitoring**: Request timing and resource usage

### Debug Capabilities
**AI Debug Tools**:
- **Prompt Logging**: AI prompt and response logging
- **Stream Debugging**: Real-time stream monitoring
- **Error Tracking**: Comprehensive error logging and analysis
- **Performance Metrics**: AI response time and token usage tracking

## Deployment Architecture

### Build Process
**Production Build**:
- **TypeScript Compilation**: Source code compilation to JavaScript
- **Dependency Management**: Production dependency installation
- **Environment Preparation**: Configuration and setup automation
- **Health Checks**: Automated service health verification

### Service Dependencies
**External Dependencies**:
- **PostgreSQL Database**: Primary data storage
- **Ollama Service**: AI model hosting
- **RSS Feed Sources**: External content sources
- **Social Media APIs**: Platform integration endpoints

## Future Technology Considerations

### Scalability Enhancements
- **Microservices Architecture**: Potential service decomposition
- **Container Orchestration**: Docker and Kubernetes support
- **Message Queue Integration**: Asynchronous processing capabilities
- **CDN Integration**: Content delivery optimization

### AI Technology Evolution
- **Multi-Model Support**: Support for different AI providers
- **Model Fine-Tuning**: Custom model training capabilities
- **Advanced Analytics**: AI performance monitoring and optimization
- **Collaborative AI**: Multi-user AI interaction support