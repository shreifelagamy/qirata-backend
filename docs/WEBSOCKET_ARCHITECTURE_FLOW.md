# WebSocket Architecture Flow Diagram

## Complete System Flow

```mermaid
graph TB
    FE[Frontend Socket Client] -->|WebSocket Events| SS[Socket Service]
    SS -->|Route Event| WR[WebSocket Router]
    WR -->|Middleware Check| MW[WebSocket Middleware]
    MW -->|Auth/Rate Limit| WR
    WR -->|Controller Method| CC[Chat Controller]

    CC -->|Build Context| CSS[Chat Session Service]
    CSS -->|Check Cache| SC[Session Cache]
    SC -->|Cache Miss| DB[(Database)]
    DB -->|Session Data| SC
    SC -->|Cached Session| CSS

    CSS -->|AI Context| CC
    CC -->|Stream Message| AIS[AI Service]
    AIS -->|Intent Detection| CC
    CC -->|Stream Callback| SS
    SS -->|Real-time Events| FE

    AIS -->|Complete Response| CC
    CC -->|Save Message| CSS
    CSS -->|Store| DB
    CC -->|Update Cache| SC
    CC -->|Final Event| SS

    subgraph "WebSocket Layer"
        SS["Socket Service<br/>- Connection Management<br/>- Event Registration<br/>- Real-time Emission"]
        WR["WebSocket Router<br/>- Route Resolution<br/>- Middleware Application<br/>- Controller Dispatch"]
        MW["WebSocket Middleware<br/>- Authentication<br/>- Rate Limiting<br/>- Validation"]
    end

    subgraph "Controller Layer"
        CC["Chat Controller<br/>- Unified Chat Logic<br/>- Stream Management<br/>- Intent Handling<br/>- Socket Coordination"]
    end

    subgraph "Service Layer"
        CSS["Chat Session Service<br/>- Pure Business Logic<br/>- Context Building<br/>- Message Persistence<br/>- Cache Management"]
        AIS["AI Service<br/>- LangChain Integration<br/>- Intent Detection<br/>- Streaming Responses"]
    end

    subgraph "Data Layer"
        SC["Session Cache<br/>- In-Memory Storage<br/>- 1-hour TTL<br/>- Session + Messages"]
        DB["Database<br/>- Chat Sessions<br/>- Messages<br/>- Posts<br/>- User Preferences"]
    end
```

## Detailed Message Flow

### 1. User Sends Message
```mermaid
sequenceDiagram
    participant FE as Frontend
    participant SS as Socket Service
    participant WR as WebSocket Router
    participant MW as Middleware
    participant CC as Chat Controller
    participant CSS as Chat Session Service
    participant SC as Session Cache
    participant DB as Database
    participant AIS as AI Service

    FE->>SS: emit('chat:message', {sessionId, content})
    SS->>WR: handleEvent('chat:message', socket, data)
    WR->>MW: applyMiddleware(['auth', 'rateLimit'])
    MW-->>WR: {success: true}
    WR->>CC: handleMessage(data, userId, socket, emit)

    Note over CC: Validate and setup streaming
    CC->>CSS: exists(sessionId)
    CSS->>SC: check cache for session

    alt Cache Hit
        SC-->>CSS: return cached session
    else Cache Miss
        CSS->>DB: findOne(sessionId)
        DB-->>CSS: session data
        CSS->>SC: cache session with TTL
    end

    CSS-->>CC: session exists = true

    Note over CC: Build AI Context
    CC->>CSS: buildAIContext(sessionId)
    CSS->>SC: get cached session
    CSS->>DB: getRecentMessages(sessionId, 10)
    CSS-->>CC: AIContext {postContent, messages, summary}

    Note over CC: Start AI Streaming
    CC->>AIS: streamMessage(content, sessionId, context, callback)
    AIS-->>CC: streamCallback('start', {intentType})
    CC->>SS: emit('chat:stream:start', data)
    SS-->>FE: Real-time stream start

    loop Streaming Tokens
        AIS-->>CC: streamCallback('token', {token})
        CC->>SS: emit('chat:stream:token', data)
        SS-->>FE: Real-time token
    end

    AIS-->>CC: streamingResponse {content, intentType, isComplete}

    alt Intent: Question
        CC->>SS: emit('chat:stream:end', {content})
    else Intent: Social Post
        CC->>SS: emit('chat:social:generated', {posts, content})
    end

    SS-->>FE: Final response

    Note over CC: Save to Database
    CC->>CSS: saveMessage(sessionId, userMsg, aiResponse)
    CSS->>DB: save message
    CSS->>SC: update cache if exists
```

## Cache Strategy

### Session Cache Details
```mermaid
graph LR
    subgraph "Session Cache (Map<string, CachedSession>)"
        CK[Cache Key: sessionId]
        CV[Cache Value]

        subgraph "CachedSession Object"
            CS[chatSession: ChatSession]
            CA[cacheAt: Date]
        end

        CV --> CS
        CV --> CA
    end

    subgraph "Cache Logic"
        TTL[TTL: 1 hour]
        HIT[Cache Hit: Return cached data]
        MISS[Cache Miss: Query DB + Cache result]
        INVALID[Cache Invalid: Query DB + Update cache]
    end

    CK --> TTL
    TTL --> HIT
    TTL --> MISS
    TTL --> INVALID
```

### Cache Implementation
```typescript
// In ChatSessionService
private sessionCache = new Map<string, {
    chatSession: ChatSession,
    cacheAt: Date
}>();

private isCacheValid(cacheAt: Date): boolean {
    const CACHE_TTL_MS = 3600000; // 1 hour
    return (new Date().getTime() - cacheAt.getTime()) < CACHE_TTL_MS;
}

private async getCachedSession(sessionId: string): Promise<ChatSession | null> {
    const cached = this.sessionCache.get(sessionId);

    // Check TTL
    if (cached && this.isCacheValid(cached.cacheAt)) {
        return cached.chatSession; // Cache hit
    }

    // Cache miss or invalid - query database
    const session = await this.chatSessionRepository.findOne({
        where: { id: sessionId },
        relations: ['post', 'post.expanded']
    });

    if (session) {
        // Update cache
        this.sessionCache.set(sessionId, {
            chatSession: session,
            cacheAt: new Date()
        });
    }

    return session;
}
```

## Database Schema Integration

### Entity Relationships
```mermaid
erDiagram
    ChatSession ||--o{ Message : contains
    ChatSession ||--o| Post : "based on"
    Post ||--|| PostExpanded : "has content"
    Message }|--|| ChatSession : "belongs to"

    ChatSession {
        string id PK
        string title
        string post_id FK
        text summary
        datetime last_summary_at
        datetime created_at
        datetime updated_at
    }

    Message {
        string id PK
        string chat_session_id FK
        text user_message
        text ai_response
        datetime created_at
    }

    Post {
        string id PK
        string title
        string url
        datetime created_at
    }

    PostExpanded {
        string id PK
        string post_id FK
        text content
        text summary
        datetime created_at
    }
```

### Database Operations Flow
```mermaid
graph TB
    subgraph "Read Operations"
        R1[Get Session: cached or DB query]
        R2[Get Recent Messages: DB query with limit]
        R3[Build AI Context: combine cached + fresh data]
    end

    subgraph "Write Operations"
        W1[Save Message: user + AI response]
        W2[Update Session Summary: when available]
        W3[Update Cache: keep in sync with DB]
    end

    subgraph "Cache Sync"
        S1[Read: Check cache first, fallback to DB]
        S2[Write: Update DB, then update cache]
        S3[TTL: Auto-expire after 1 hour]
    end

    R1 --> S1
    R2 --> S1
    W1 --> S2
    W2 --> S2
    S2 --> S3
```

## AI Intent Detection Flow

### Intent-Based Response Handling
```mermaid
graph TB
    UM[User Message] --> AIS[AI Service]
    AIS --> ID[Intent Detection]

    ID --> QI[Question Intent]
    ID --> SPI[Social Post Intent]

    QI --> QR[Question Response]
    SPI --> SPR[Social Post Response]

    subgraph "Question Response Flow"
        QR --> QC[Use Post Content + History]
        QC --> QA[Generate Answer]
        QA --> QE[Emit: chat:stream:end]
    end

    subgraph "Social Post Response Flow"
        SPR --> SPC[Use Post Content + Preferences]
        SPC --> SPG[Generate Social Posts]
        SPG --> SPE[Emit: chat:social:generated]
    end

    QE --> SS[Save to Database]
    SPE --> SS
```

### AI Context Building
```mermaid
graph LR
    subgraph "AI Context Components"
        PC[Post Content<br/>From cached session]
        PM[Previous Messages<br/>Last 10 from DB]
        CS[Conversation Summary<br/>From cached session]
        UP[User Preferences<br/>Voice, style, platform]
    end

    PC --> AC[AI Context Object]
    PM --> AC
    CS --> AC
    UP --> AC

    AC --> AIS[AI Service]
    AIS --> IR[Intent Recognition]
    AIS --> RG[Response Generation]
```

## Performance Considerations

### Caching Benefits
1. **Reduced DB Queries**: Session data cached for 1 hour
2. **Faster Response Times**: Immediate access to frequently used sessions
3. **Memory Efficient**: Only active sessions cached
4. **Auto-Cleanup**: TTL prevents memory leaks

### Streaming Benefits
1. **Real-time UX**: Users see responses as they're generated
2. **Responsive Interface**: No waiting for complete response
3. **Interruptible**: Users can stop generation mid-stream
4. **Intent Awareness**: UI adapts based on detected intent

### Database Optimization
1. **Recent Messages**: Limited to last 10 for context
2. **Indexed Queries**: session_id, created_at indexed
3. **Efficient Relations**: Only load needed associations
4. **Batch Operations**: Single save operation per message

## Error Handling & Resilience

### Error Flow
```mermaid
graph TB
    E1[WebSocket Error] --> EH[Error Handler]
    E2[AI Service Error] --> EH
    E3[Database Error] --> EH
    E4[Cache Error] --> EH

    EH --> ER[Error Response]
    ER --> CL[Cleanup Resources]
    CL --> EM[Emit Error Event]
    EM --> FE[Frontend Error Handling]

    subgraph "Cleanup Actions"
        CL --> CS[Clear Active Streams]
        CL --> CC[Clear Socket State]
        CL --> CR[Remove from Active Connections]
    end
```

This architecture provides a robust, scalable, and maintainable WebSocket system with efficient caching and clear separation of concerns!