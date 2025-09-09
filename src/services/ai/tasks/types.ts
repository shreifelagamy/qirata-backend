import { z } from 'zod';
import { partial } from 'zod/v4/core/util';

// Simplified message schema for memory storage
export const SimplifiedMessage = z.object({
    user_message: z.string(),
    ai_response: z.string()
});

// Memory state schema for socket-based storage
export const MemoryState = z.object({
    sessionId: z.string(),
    userId: z.string(),
    // post related state
    currentPostId: z.string().optional(),
    postSummary: z.string().optional(),
    postContent: z.string().optional(),
    // platform related state
    detectedPlatform: z.enum(['twitter', 'linkedin']).optional(),
    // social post related state
    lastGeneratedSocialPost: z.string().optional(),
    lastGeneratedPlatform: z.enum(['twitter', 'linkedin']).optional(),
    // conversation related state
    lastMessages: z.array(SimplifiedMessage).max(10).default([]),
    messagesCount: z.number().default(0),
    conversationSummary: z.string().optional(),
});

const aiResponse = z.object({
    intent: z.enum(['GENERAL', 'REQ_SOCIAL_POST', 'ASK_POST', 'EDIT_LAST_POST']).optional(),
    message: z.string().optional(),
    suggestedOptions: z.array(z.string()).optional(),
    needsSocialClarification: z.boolean().optional(),
})

export const TaskOutput = z.object({
    response: aiResponse,
    contextUpdates: MemoryState.partial().optional(),
})

export type SimplifiedMessage = z.infer<typeof SimplifiedMessage>;
export type MemoryStateType = z.infer<typeof MemoryState>;

