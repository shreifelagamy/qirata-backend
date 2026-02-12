import { StateSchema } from '@langchain/langgraph';
import { z } from 'zod';

// Simplified message schema for memory storage
export const SimplifiedMessageSchema = z.object({
    user_message: z.string(),
    ai_response: z.string()
});

// Grouped schema for intent detection results
export const IntentResultSchema = z.object({
    type: z.enum(['GENERAL', 'REQ_SOCIAL_POST', 'ASK_POST', 'EDIT_SOCIAL_POST', 'CLARIFY_INTENT'])
        .describe('Detected user intent'),
    confidence: z.number()
        .min(0)
        .max(1)
        .describe('Confidence score for intent detection'),
    reasoning: z.string()
        .describe('Reasoning behind intent classification'),
    clarifyingQuestion: z.string()
        .optional()
        .describe('Question to ask when intent needs clarification'),
});

// Post schema for lightweight context
export const PostSchema = z.object({
    title: z.string().describe('Title of the post'),
    summary: z.string().optional().describe('Summary of the post'),
    content: z.string().optional().describe('Full content of the post'),
});

// Grouped schema for platform detection results
export const PlatformResultSchema = z.object({
    platform: z.enum(['twitter', 'linkedin'])
        .nullable()
        .describe('Detected platform (null if unclear)'),
    confidence: z.number()
        .min(0)
        .max(1)
        .describe('Confidence score for platform detection'),
    needsClarification: z.boolean()
        .describe('Whether clarification is needed'),
    clarificationMessage: z.string()
        .optional()
        .describe('Message explaining detection or asking for clarification'),
});

// Structured social post schema
export const StructuredPostSchema = z.object({
    postContent: z.string()
        .describe('Main text content for the social media post'),
    codeExamples: z.array(z.object({
        language: z.string().describe('Programming language'),
        code: z.string().describe('The actual code content'),
        description: z.string().nullable().describe('Optional explanation of the code')
    })).nullable()
        .describe('Optional array of code snippets'),
    visualElements: z.array(z.object({
        type: z.string().describe('Type of visual'),
        description: z.string().describe('Detailed description of the visual to create'),
        content: z.string().describe('Text content or data for the visual'),
        style: z.string().describe('Visual style preferences')
    })).nullable()
        .describe('Optional array of visual elements to create')
});

/**
 * Chat Graph State - Minimal version for intent detection
 *
 * This state schema uses the new StateSchema + Zod API recommended in LangGraph 1.x
 * for full type safety across the graph.
 */
export const ChatGraphState = new StateSchema({
    // ===== Input (set before graph.invoke) =====
    message: z.string().describe('Current user message'),
    sessionId: z.string().describe('Chat session identifier'),
    userId: z.string().describe('User identifier'),

    // ===== Memory (loaded before invoke, read-only during graph) =====
    lastMessages: z.array(SimplifiedMessageSchema)
        .max(10)
        .default([])
        .describe('Last 10 messages for conversation context'),
    lastIntent: z.string()
        .optional()
        .describe('Previously detected intent for context continuity'),
    post: PostSchema
        .optional()
        .describe('Current post context'),
    socialMediaContentPreferences: z.string()
        .optional()
        .describe('User preferences for social media content style'),


    // ===== Processing (written by nodes) =====
    intentResult: IntentResultSchema
        .optional()
        .describe('Result of the intent detection process'),
    platformResult: PlatformResultSchema
        .optional()
        .describe('Result of the platform detection process'),
    editingSocialPostId: z.string()
        .optional()
        .describe('If editing an existing social post, the ID of that post'),

    // ===== Output (read after graph.invoke returns) =====
    response: z.string()
        .optional()
        .describe('Final AI response to user'),
    suggestedOptions: z.array(z.string())
        .optional()
        .describe('Suggested action options for the user'),
    isSocialPost: z.boolean()
        .default(false)
        .describe('Whether this message is a social post generation/edit result'),
    structuredPost: StructuredPostSchema
        .nullable()
        .optional()
        .describe('Structured social post content with code and visual elements'),
    error: z.string()
        .optional()
        .describe('Error message if something goes wrong'),
});

// Type extraction for TypeScript usage
export type ChatGraphStateType = typeof ChatGraphState.State;
export type ChatGraphUpdateType = typeof ChatGraphState.Update;
