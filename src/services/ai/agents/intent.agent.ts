import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { createDebugCallback } from '../../../utils/debug-callback';

// Enhanced input schema with better context
const IntentRouterInput = z.object({
    message: z.string().describe('The current user message to classify'),
    lastMessages: z.array(z.string()).max(5).describe('Up to 5 previous messages for context'),
    lastIntent: z.string().optional(),
});

// Enhanced output schema with confidence and reasoning
export const IntentRouterOutput = z.object({
    intent: z.enum(['GENERAL', 'REQ_SOCIAL_POST', 'ASK_POST', 'EDIT_SOCIAL_POST', 'CLARIFY_INTENT']).describe('The classified intent'),
    confidence: z.number().min(0).max(1).describe('Confidence score between 0 and 1'),
    reasoning: z.string().min(10).describe('Brief explanation for the classification decision'),
    clarifyingQuestion: z.string().nullable().describe('Clarifying question to ask when intent is unclear (required when intent is CLARIFY_INTENT)'),
    suggestedOptions: z.array(z.string()).max(3).nullable().describe('Short, direct context-aware options for the user (required for CLARIFY_INTENT)'),
});

// Cached system prompt for consistent performance
const CACHED_SYSTEM_PROMPT = `You are an expert qirata intent classifier for our application.

Your task is to classify the intent of the user last message to these avaliable intents:

1. GENERAL - General conversation, greetings, casual chat, or non-specific requests
   Examples: "hi", "hello", "how are you?", "what should I do?", "thanks", "help me"

2. REQ_SOCIAL_POST - Requests to create new social media content
   Examples: "create a LinkedIn post about AI", "make me a tweet", "write a post for Instagram"

3. ASK_POST - Questions about an existing post/articale or their content
   Examples: "what is this post about?", "summarize the article", "explain this content", "What is x?"

4. EDIT_SOCIAL_POST - Requests to modify any previously created social media post
   Examples:
   - "change the intro", "make it shorter" (implies most recent post)
   - "edit the LinkedIn post", "update the Twitter post" (specific platform)
   - "modify the post about AI", "change the marketing post" (content reference)
   - "update the second post", "edit the first one" (position reference)

5. CLARIFY_INTENT - When you can't clarify the user's intent and it's seems ambiguous (confidence < 0.7)
   Use this when you cannot confidently classify the message into the above categories.
   Examples: "do something", "help with this", "change it", vague references without context

Classification Guidelines:
- Use previous messages to understand conversation flow
- Consider the last intent to maintain context continuity
- If confidence is below 0.7, use CLARIFY_INTENT and provide a clarifying question
- If ambiguous but with reasonable context clues, choose the most likely intent with appropriate confidence
- Consider ASK POST category if the user is likely asking about something

You must respond with a JSON object containing:
- intent: one of the five intents above
- confidence: a number between 0.0 and 1.0
- reasoning: a brief explanation for your decision
- clarifyingQuestion: required when intent is CLARIFY_INTENT, optional otherwise
- suggestedOptions: array of up to 3 context-aware options (required for CLARIFY_INTENT, optional for others)`;

export async function intentAgent(options: z.infer<typeof IntentRouterInput>): Promise<z.infer<typeof IntentRouterOutput>> {
    const intentTool = {
        name: "intentResponse",
        description: "Classify user intent and provide analysis",
        schema: zodToJsonSchema(IntentRouterOutput)
    };

    const model = new ChatOpenAI({
        model: 'gpt-4.1-mini',
        temperature: 0,
        maxTokens: 200,
        openAIApiKey: process.env.OPENAI_API_KEY
    }).bindTools([intentTool]);

    const messages = []
    messages.push(new SystemMessage(CACHED_SYSTEM_PROMPT))

    messages.push(new AIMessage("My Last intent was: " + (options.lastIntent || "None")))

    if (options.lastMessages.length > 0) {
        options.lastMessages.forEach((msg, index) => {
            messages.push(new HumanMessage(msg))
        })
    }

    // confirm receiving the old messages
    messages.push(new AIMessage('I have the old messages and will maintain context.'))

    messages.push(new HumanMessage(options.message))

    const result = await model.invoke(messages, {
        callbacks: [
            createDebugCallback('intent-router')
        ]
    });

    // Extract tool call result
    const toolCall = result.tool_calls?.[0];
    if (!toolCall) {
        throw new Error('No tool call found in response');
    }

    // Validate with Zod and return
    return IntentRouterOutput.parse(toolCall.args);
}