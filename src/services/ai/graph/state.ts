import { StateSchema } from '@langchain/langgraph';
import { z } from 'zod';
import { MessageType } from '../../../entities/message.entity';

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


    // ===== Processing (written by nodes) =====
    intentResult: IntentResultSchema
        .optional()
        .describe('Result of the intent detection process'),

    // ===== Output (read after graph.invoke returns) =====
    response: z.string()
        .optional()
        .describe('Final AI response to user'),
    suggestedOptions: z.array(z.string())
        .optional()
        .describe('Suggested action options for the user'),
    messageType: z.nativeEnum(MessageType)
        .optional()
        .describe('Type of message being returned'),
    error: z.string()
        .optional()
        .describe('Error message if something goes wrong'),
});

// Type extraction for TypeScript usage
export type ChatGraphStateType = typeof ChatGraphState.State;
export type ChatGraphUpdateType = typeof ChatGraphState.Update;
