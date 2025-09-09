import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

// Enhanced input schema with better context
const IntentRouterInput = z.object({
    message: z.string().describe('The current user message to classify'),
    lastMessages: z.array(z.string()).max(5).describe('Up to 5 previous messages for context'),
});

// Enhanced output schema with confidence and reasoning
export const IntentRouterOutput = z.object({
    intent: z.enum(['GENERAL', 'REQ_SOCIAL_POST', 'ASK_POST', 'EDIT_LAST_POST']).describe('The classified intent'),
    confidence: z.number().min(0).max(1).describe('Confidence score between 0 and 1'),
    reasoning: z.string().min(10).describe('Brief explanation for the classification decision'),
});

// Cached system prompt for consistent performance
const CACHED_SYSTEM_PROMPT = `You are an expert intent classifier for a chat application that handles social media content creation.

Your task is to classify user messages into one of these intents:

1. GENERAL - General conversation, greetings, casual chat, or non-specific requests
   Examples: "hi", "hello", "how are you?", "what should I do?", "thanks", "help me"

2. REQ_SOCIAL_POST - Requests to create new social media content
   Examples: "create a LinkedIn post about AI", "make me a tweet", "write a post for Instagram"

3. ASK_POST - Questions about existing posts or their content
   Examples: "what is this post about?", "summarize the article", "explain this content"

4. EDIT_LAST_POST - Requests to modify the most recently created post
   Examples: "change the intro", "make it shorter", "add hashtags to the last post"

Context considerations:
- Use previous messages to understand conversation flow
- Consider the last action to maintain context continuity
- If ambiguous, choose the most likely intent based on conversational context

You must respond with a JSON object containing:
- intent: one of the four intents above
- confidence: a number between 0.0 and 1.0
- reasoning: a brief explanation for your decision`;

export async function intentAgent(options: z.infer<typeof IntentRouterInput>): Promise<z.infer<typeof IntentRouterOutput>> {
    const model = new ChatOpenAI({
        model: 'gpt-4.1-mini',
        temperature: 0,
        maxTokens: 200,
        openAIApiKey: process.env.OPENAI_API_KEY
    }).withStructuredOutput(IntentRouterOutput);

    const contextMessages = options.lastMessages.length > 0
        ? `Recent conversation context: ${options.lastMessages.join(' → ')}\n`
        : '';


    const userPrompt = `${contextMessages}Current message: "${options.message}"

Classify this message and provide your analysis.`;

    const result = await model.invoke([
        { role: 'system', content: CACHED_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
    ]);

    return result;
}