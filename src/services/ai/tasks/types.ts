import { z } from 'zod';

// Schema for a single cached social post
export const CachedSocialPost = z.object({
    id: z.string(),
    platform: z.enum(['twitter', 'linkedin']),
    content: z.string(),
    cachedAt: z.date(),
});

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
    socialPostsCache: z.object({
        posts: z.array(CachedSocialPost),
        cachedAt: z.date()
    }).optional(),
    // user preferences
    socialMediaContentPreferences: z.string().optional(),
    // conversation related state
    lastMessages: z.array(SimplifiedMessage).max(10).default([]),
    messagesCount: z.number().default(0),
    conversationSummary: z.string().optional(),
});

const aiResponse = z.object({
    intent: z.enum(['GENERAL', 'REQ_SOCIAL_POST', 'ASK_POST', 'EDIT_SOCIAL_POST', 'CLARIFY_INTENT']).optional(),
    message: z.string().optional(),
    suggestedOptions: z.array(z.string()).optional(),
    needsSocialClarification: z.boolean().optional(),
    clarifyingQuestion: z.string().optional(),
    socialPostContent: z.string().optional(),
    socialPostId: z.string().optional(),
    structuredPost: z.object({
        postContent: z.string(),
        codeExamples: z.array(z.object({
            language: z.string(),
            code: z.string(),
            description: z.string().optional()
        })).optional(),
        visualElements: z.array(z.object({
            type: z.string(),
            description: z.string(),
            content: z.string(),
            style: z.string()
        })).optional()
    }).optional(),
})

export const TaskOutput = z.object({
    response: aiResponse,
    contextUpdates: MemoryState.partial().optional(),
})

export type SimplifiedMessage = z.infer<typeof SimplifiedMessage>;
export type MemoryStateType = z.infer<typeof MemoryState>;
export type CachedSocialPostType = z.infer<typeof CachedSocialPost>;
