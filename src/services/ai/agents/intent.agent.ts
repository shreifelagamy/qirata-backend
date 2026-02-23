import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

import { createAgent, toolStrategy } from 'langchain';
import { createDebugCallback } from '../../../utils/debug-callback';

// Enhanced input schema with better context
const IntentRouterInput = z.object({
    message: z.string().describe('The current user message to classify'),
    lastMessages: z.array(z.object({
        user_message: z.string(),
        ai_response: z.string()
    })).max(10).describe('Previous conversation messages for context'),
    lastIntent: z.string().optional(),
});

// Enhanced output schema with confidence and reasoning
export const IntentRouterOutput = z.object({
    intent: z.enum(['SUPPORT', 'SOCIAL', 'ASK_POST']).describe('The classified intent domain'),
    confidence: z.number().min(0).max(1).describe('Confidence score between 0 and 1'),
    needsClarification: z.boolean().describe('True when the request is ambiguous and requires clarification inside the Support flow'),
    reasoning: z.string().min(10).describe('Brief explanation for the classification decision'),
});

// Cached system prompt for consistent performance
const CACHED_SYSTEM_PROMPT = `You are the Qirata intent classifier.

Task: classify the user's latest message into exactly ONE domain:

1) SUPPORT
- Questions about Qirata itself, general help, or topics with NO active article context.
- Do NOT use SUPPORT for technical questions that are clearly about content from the current article being discussed.
- Anything that is NOT social post creation/editing and NOT asking about a specific post/article.
- Includes greetings, thanks, casual chat, vague requests, and app/help/troubleshooting questions.

2) SOCIAL
- Anything about creating, editing, rewriting, improving, repurposing, or generating social media content.
- Do NOT decide create vs edit here; that happens inside the Social flow.

3) ASK_POST
- Questions about an existing article/post/content: summarize, explain, extract key points, or clarify meaning.

Rules:
- If lastIntent is ASK_POST and the user's question is a follow-up about the same article (asking about tools, concepts, or steps mentioned in it), classify as ASK_POST — even if the question sounds like a "how-to". The article context takes priority.
- Only switch away from ASK_POST if the user clearly shifts topic (e.g., greets, asks about the app itself, or requests social content).
- If the user refers to "it/that/this" and recent context is social-related, choose SOCIAL.
- If confidence < 0.7, still choose the most likely domain and set needsClarification=true.
- Never output anything except the JSON object described below.

Output (STRICT JSON):
{
  "intent": "SUPPORT" | "SOCIAL" | "ASK_POST",
  "confidence": number,
  "needsClarification": boolean,
  "reasoning": string
}`;

export default async function intentAgent(options: z.infer<typeof IntentRouterInput>): Promise<z.infer<typeof IntentRouterOutput>> {
    // Initialize model
    const model = new ChatOpenAI({
        model: 'gpt-5-mini',
        reasoning: {
            effort: "low"
        },
        openAIApiKey: process.env.OPENAI_API_KEY
    });

    // Create agent
    const agent = createAgent({
        model,
        tools: [],
        responseFormat: toolStrategy(IntentRouterOutput)
    });

    const result = await agent.invoke({
        messages: buildMessagesArray(options)
    }, {
        callbacks: [
            createDebugCallback('intent-router')
        ]
    });


    // Validate with Zod and return
    return result.structuredResponse;
}

function buildMessagesArray(options: z.infer<typeof IntentRouterInput>): BaseMessage[] {
    const messages: BaseMessage[] = [];
    messages.push(new SystemMessage(CACHED_SYSTEM_PROMPT))

    messages.push(new AIMessage("My Last intent was: " + (options.lastIntent || "None")))

    if (options.lastMessages.length > 0) {
        options.lastMessages.forEach((msg, index) => {
            messages.push(new HumanMessage(msg.user_message))
            messages.push(new AIMessage(msg.ai_response))
        })
    }

    // confirm receiving the old messages
    messages.push(new AIMessage('I will use prior messages for context and continuity.'))

    messages.push(new HumanMessage(options.message))

    return messages;
}