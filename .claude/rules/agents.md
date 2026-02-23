# Agent Naming Conventions

Location: `src/services/ai/agents/`

## File Names
Use `kebab-case.agent.ts`:
- `intent.agent.ts`, `platform.agent.ts`, `support.agent.ts`
- `post-summary.agent.ts`, `post-qa.agent.ts`
- `social-post-create.agent.ts`, `social-post-edit.agent.ts`
- `full-content-check.agent.ts`, `conversation-summary.agent.ts`

## Export Names (default export)
Rule: **file name → camelCase + `Agent` suffix, always**

| File | Export |
|---|---|
| `post-summary.agent.ts` | `postSummaryAgent` |
| `full-content-check.agent.ts` | `fullContentCheckAgent` |
| `intent.agent.ts` | `intentAgent` |
| `platform.agent.ts` | `platformAgent` |
| `social-post-create.agent.ts` | `socialPostCreateAgent` |
| `social-post-edit.agent.ts` | `socialPostEditAgent` |
| `support.agent.ts` | `supportAgent` |
| `post-qa.agent.ts` | `postQAAgent` |
| `conversation-summary.agent.ts` | `conversationSummaryAgent` |

## Schema Names
Use `<AgentName>Input` / `<AgentName>Output` matching the export name exactly:
- `intentAgent` → `IntentAgentInput`, `IntentAgentOutput`
- `supportAgent` → `SupportAgentInput`, `SupportAgentOutput`
- `postSummaryAgent` → `PostSummaryAgentInput`, `PostSummaryAgentOutput`

## Agent Structure

Agents are **async functions**, never classes. Each agent file follows this structure:

### 1. Zod Schemas (top of file)
Define input and output schemas using Zod before anything else:
```ts
const SocialPostCreateInput = z.object({ ... });          // private, no export needed
export const SocialPostCreateOutput = z.object({ ... });  // exported so callers can infer the type
```
- Input schema is private (no export)
- Output schema is exported so consumers can use `z.infer<typeof SocialPostCreateOutput>`

### 2. System Prompt (constant)
Define the system prompt as a `const` string above the function:
```ts
const CACHED_SYSTEM_PROMPT = `...`;
```

### 3. Agent Function (default export)
The agent is a plain `async function` that is the `default` export:
```ts
export default async function socialPostCreateAgent(
    options: z.infer<typeof SocialPostCreateInput>
): Promise<z.infer<typeof SocialPostCreateOutput>> {
    const model = new ChatOpenAI({ ... });

    const agent = createAgent({
        model,
        tools: [],
        responseFormat: toolStrategy(SocialPostCreateOutput)  // forces structured output
    });

    const result = await agent.invoke({ messages: buildMessagesArray(options) }, {
        callbacks: [createDebugCallback('agent-name')]
    });

    return result.structuredResponse;
}
```

### 4. Message Builder (private helper)
Extract message construction into a private helper function at the bottom:
```ts
function buildMessagesArray(options: z.infer<typeof SocialPostCreateInput>): BaseMessage[] {
    // build and return messages array
}
```

### Key Rules
- Always use `createAgent` + `toolStrategy(OutputSchema)` — never use raw `.invoke()` on the model directly
- `toolStrategy` is what forces the LLM to return structured output matching the Zod schema
- Always pass `createDebugCallback('agent-name')` as a callback for observability
- Use `z.infer<typeof Schema>` for TypeScript types — never duplicate type definitions manually
