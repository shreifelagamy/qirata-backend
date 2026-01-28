# Migration Plan: LangGraph Functional API → StateGraph API

## Overview

Migrate `QirataChatWorkflow` (680-line class using `entrypoint()` + `task()`) to a proper **StateGraph** with typed state, conditional edges, and clean node functions. All existing **agents stay untouched**. Old files are kept alongside new ones.

---

## New Directory Structure

```
src/services/ai/graph/               ← NEW
├── state.ts                          ← StateSchema + Zod state definition
├── configurable.ts                   ← Type for services/socket passed via config
├── chat.graph.ts                     ← StateGraph definition (nodes + edges)
├── chat-graph.service.ts             ← Orchestration: memory loading, invoke, side effects
├── nodes/
│   ├── index.ts
│   ├── intent.node.ts                ← Calls intentAgent → writes intent to state
│   ├── support.node.ts               ← Calls supportAgent → writes response
│   ├── post-qa.node.ts               ← Calls postQAAgent (with full-content retry)
│   ├── platform.node.ts              ← Calls platformAgent → writes platform detection
│   ├── social-post.node.ts           ← Calls socialPostAgent (new post)
│   ├── social-post-edit.node.ts      ← Fetches posts, calls socialPostAgent (edit)
│   ├── clarify.node.ts               ← Formats intent clarification as response
│   └── platform-clarification.node.ts ← Formats platform clarification as response
└── routers/
    ├── intent.router.ts              ← Routes by detected intent enum
    └── platform.router.ts            ← Routes by platform detected vs needs clarification
```

---

## Graph Topology

```
START → intent → [conditional: routeByIntent]
  ├── GENERAL          → support              → END
  ├── ASK_POST         → postQA               → END
  ├── REQ_SOCIAL_POST  → platform → [conditional: routeByPlatform]
  │                        ├── detected    → socialPost             → END
  │                        └── unclear     → platformClarification  → END
  ├── EDIT_SOCIAL_POST → socialPostEdit        → END
  └── CLARIFY_INTENT   → clarify              → END
```

---

## State Design (`state.ts`)

Uses the new **`StateSchema` + Zod** API (recommended in LangGraph 1.x), not the old `Annotation.Root`:

```typescript
import { StateSchema } from '@langchain/langgraph';
import { z } from 'zod';

const ChatGraphState = new StateSchema({
    // Input (set before graph.invoke)
    message:    z.string(),
    sessionId:  z.string(),
    userId:     z.string(),

    // Memory (loaded before invoke, read-only during graph)
    currentPostId:                  z.string().optional(),
    postSummary:                    z.string().optional(),
    postContent:                    z.string().optional(),
    detectedPlatform:               z.enum(['twitter', 'linkedin']).optional(),
    socialMediaContentPreferences:  z.string().optional(),
    lastMessages:                   z.array(SimplifiedMessageSchema).default([]),
    messagesCount:                  z.number().default(0),
    conversationSummary:            z.string().optional(),
    lastIntent:                     z.string().optional(),

    // Processing (written by nodes)
    intent:                     z.enum(['GENERAL', 'REQ_SOCIAL_POST', 'ASK_POST',
                                       'EDIT_SOCIAL_POST', 'CLARIFY_INTENT']).optional(),
    intentConfidence:           z.number().optional(),
    intentReasoning:            z.string().optional(),
    clarifyingQuestion:         z.string().optional(),
    platformDetected:           z.enum(['twitter', 'linkedin']).optional(),
    platformNeedsClarification: z.boolean().optional(),
    fullContentFetched:         z.string().optional(),
    existingSocialPosts:        z.array(SocialPostContextSchema).optional(),
    editedSocialPostId:         z.string().optional(),

    // Output (read after graph.invoke returns)
    response:         z.string().optional(),
    suggestedOptions: z.array(z.string()).optional(),
    messageType:      z.nativeEnum(MessageType).optional(),
    structuredPost:   StructuredPostSchema.nullable().optional(),
    error:            z.string().optional(),
});

// Type extraction
type ChatGraphStateType = typeof ChatGraphState.State;
type ChatGraphUpdateType = typeof ChatGraphState.Update;
```

Nodes are typed with `GraphNode<typeof ChatGraphState>` for full type safety.

**Key decision:** `socket`, `emit`, and all services (`SocketMemoryService`, `SocialPostsService`, `MessagesService`, `PostsService`) go in `config.configurable`, NOT in state.

---

## Configurable Context (`configurable.ts`)

```typescript
interface ChatGraphConfigurable {
    thread_id: string;
    session_id: string;
    socket: AuthenticatedSocket;
    emit: (event: string, data: any) => void;
    socketMemoryService: SocketMemoryService;
    socialPostsService: SocialPostsService;
    messagesService: MessagesService;
    postsService: PostsService;
}
```

Nodes access via `config.configurable` — only `post-qa.node.ts` and `social-post-edit.node.ts` need services.

---

## Node Design

Each node typed as `GraphNode<typeof ChatGraphState>`: `(state, config) → ChatGraphUpdateType`

| Node | Agent Called | Key Logic |
|------|------------|-----------|
| `intent.node.ts` | `intentAgent()` | Writes intent, confidence, clarifyingQuestion to state |
| `support.node.ts` | `supportAgent()` | Writes response, suggestedOptions, messageType |
| `post-qa.node.ts` | `postQAAgent()` | Try with summary, retry with full content if needed (fetches via `postsService` from config) |
| `platform.node.ts` | `platformAgent()` | Writes platformDetected, platformNeedsClarification |
| `social-post.node.ts` | `socialPostAgent()` | Generates new post, writes response + structuredPost |
| `social-post-edit.node.ts` | `socialPostAgent()` | Fetches existing posts via `socketMemoryService`, calls agent in edit mode |
| `clarify.node.ts` | (none) | Pure state mapping — formats clarification from intent result |
| `platform-clarification.node.ts` | (none) | Sets messageType=MESSAGE, structuredPost=null |

---

## Service Layer (`chat-graph.service.ts`)

Handles everything outside the graph:

```
Phase 1: Pre-invocation
  - Load memory via socketMemoryService.ensureMemory()
  - Emit 'chat:stream:start'

Phase 2: Build state + config, invoke graph

Phase 3: Post-invocation side effects
  - Update lastIntent in socket memory
  - Save message to DB (regular or social post type)
  - Save/update social post in DB if applicable
  - Invalidate social posts cache if needed
  - Update postContent in memory if full content was fetched

Phase 4: Emit 'chat:stream:end' with final result
```

---

## Controller Change (`chat.controller.ts`)

Minimal — 2 lines:

```typescript
// BEFORE:
import { QirataChatWorkflow } from '../../services/ai/workflows/qirata-chat.workflow';
private qirataChatWorkflow = new QirataChatWorkflow();
await this.qirataChatWorkflow.start({...});

// AFTER:
import { ChatGraphService } from '../../services/ai/graph/chat-graph.service';
private chatGraphService = new ChatGraphService();
await this.chatGraphService.run({...});
```

`handleInterrupt` and `handleDisconnect` stay completely unchanged.

---

## Socket Events Timeline

| Phase | Event | Emitted by |
|-------|-------|-----------|
| Before `graph.invoke()` | `chat:stream:start` | ChatGraphService |
| During graph execution | (none — nodes are pure) | — |
| After `graph.invoke()` | `chat:stream:end` | ChatGraphService |
| On error | `chat:stream:error` | ChatController catch block (unchanged) |

Note: `chat:stream:token` progress events (e.g. "Detecting platform...") are removed for MVP. Can be restored later using `graph.stream()` or accessing `emit` from configurable in nodes.

---

## What Stays Untouched

- All agent files (`agents/*.agent.ts`) — zero changes
- All task files (`tasks/*.task.ts`) — kept, no longer called
- Old workflow (`workflows/qirata-chat.workflow.ts`) — kept alongside
- Old langgraph dir (`langgraph/`) — kept as-is
- SocketMemoryService, SocialPostsService, MessagesService, PostsService
- Socket types, middleware, routing

---

## Implementation Order

| # | File | Description |
|---|------|-------------|
| 1 | `graph/state.ts` | StateSchema + Zod state definition |
| 2 | `graph/configurable.ts` | ChatGraphConfigurable type + getConfigurable() |
| 3 | `graph/nodes/intent.node.ts` | Intent detection node |
| 4 | `graph/nodes/support.node.ts` | General support node |
| 5 | `graph/nodes/post-qa.node.ts` | Post Q&A with full-content retry |
| 6 | `graph/nodes/platform.node.ts` | Platform detection node |
| 7 | `graph/nodes/social-post.node.ts` | Social post generation node |
| 8 | `graph/nodes/social-post-edit.node.ts` | Social post edit node |
| 9 | `graph/nodes/clarify.node.ts` | Intent clarification node |
| 10 | `graph/nodes/platform-clarification.node.ts` | Platform clarification node |
| 11 | `graph/nodes/index.ts` | Node exports barrel |
| 12 | `graph/routers/intent.router.ts` | Intent routing function |
| 13 | `graph/routers/platform.router.ts` | Platform routing function |
| 14 | `graph/chat.graph.ts` | Build and compile StateGraph |
| 15 | `graph/chat-graph.service.ts` | Orchestration service |
| 16 | `chat.controller.ts` | Swap import (2 lines) |

---

## Verification

1. **TypeCheck:** `npm run typecheck` — ensure no TS errors in new files
2. **Build:** `npm run build` — ensure SWC compiles correctly
3. **Manual test:** Start dev server, connect via Socket.IO, test each intent:
   - Send "hello" → GENERAL → support response
   - Send "what is this post about?" → ASK_POST → post Q&A response
   - Send "create a LinkedIn post" → REQ_SOCIAL_POST → platform detected → social post
   - Send "create a social post" → REQ_SOCIAL_POST → platform unclear → clarification
   - Send "make it shorter" → EDIT_SOCIAL_POST → edited post
   - Send something ambiguous → CLARIFY_INTENT → clarification question
