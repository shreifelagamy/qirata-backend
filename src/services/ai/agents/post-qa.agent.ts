import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { createDebugCallback } from '../../../utils/debug-callback';

// Input schema for post Q&A
const PostQAInput = z.object({
    message: z.string().describe('The user question about the post'),
    lastMessages: z.array(z.string()).max(10).describe('Last 10 conversation messages for context'),
    postSummary: z.string().describe('Summary of the post content'),
    conversationSummary: z.string().optional().describe('Summary of previous conversation if available'),
    fullPostContent: z.string().optional().describe('Full post content if needed for detailed answers')
});

// Simple output schema matching other agents
export const PostQAOutput = z.object({
    response: z.string().min(30).describe('Answer to the user question based on post content'),
    needsFullContent: z.boolean().describe('Whether full post content is needed for a better answer'),
    suggestedOptions: z.array(z.string()).max(3).describe('Up to 3 suggested follow-up questions or actions')
});

// Cached system prompt for post Q&A
const CACHED_SYSTEM_PROMPT = `You are Qirata's AI assistant specialized in answering questions about specific posts and articles.

YOUR ROLE:
- Answer user questions using the provided post content (summary or full content)
- Maintain conversation context and reference previous discussions
- Be educational and help users understand the topic deeply

RESPONSE GUIDELINES:
1. Use post summary first for general questions
2. Indicate if you need full content for detailed/specific questions
3. Reference previous messages when relevant to avoid repetition
4. Be educational and explain concepts clearly
5. Always indicate your source: "Based on the post summary..." or "According to the full content..."

Keep responses helpful and suggest relevant follow-up questions.`;

export async function postQAAgent(options: z.infer<typeof PostQAInput>): Promise<z.infer<typeof PostQAOutput>> {
    const model = new ChatOpenAI({
        model: 'gpt-4.1-mini',
        temperature: 0.2,
        maxTokens: 350,
        openAIApiKey: process.env.OPENAI_API_KEY
    }).withStructuredOutput(PostQAOutput);

    // Build context from conversation history
    const conversationContext = options.lastMessages.length > 0
        ? `Previous conversation: ${options.lastMessages.slice(-5).join(' → ')}\n`
        : '';

    // Add conversation summary if available
    const summaryContext = options.conversationSummary
        ? `Previous discussion summary: ${options.conversationSummary}\n`
        : '';

    // Determine what content is available
    const availableContent = options.fullPostContent
        ? `FULL POST CONTENT:\n${options.fullPostContent}\n\nPOST SUMMARY:\n${options.postSummary}`
        : `POST SUMMARY:\n${options.postSummary}\n\n(Full post content not provided - indicate if needed for better answer)`;

    const userPrompt = `${conversationContext}${summaryContext}
${availableContent}

User question: "${options.message}"

Answer the question using available post content. Be educational and helpful.`;

    const result = await model.invoke([
        { role: 'system', content: CACHED_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
    ], {
        callbacks: [
            createDebugCallback('post-qa')
        ]
    });

    return result;
}