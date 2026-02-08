import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

import { createDebugCallback } from '../../../utils/debug-callback';
import { createAgent, toolStrategy } from 'langchain';

// Input schema for platform detection
const PlatformInput = z.object({
    message: z.string().describe('The current user message requesting platform detection'),
    lastMessages: z.array(z.string()).max(5).describe('Previous conversation messages for context'),
});

// Output schema for platform detection
export const PlatformOutput = z.object({
    platform: z.enum(['twitter', 'linkedin'])
        .nullable()
        .describe('The detected social media platform. Null if unclear'),
    confidence: z.number()
        .min(0)
        .max(1)
        .describe('Confidence score from 0.0 to 1.0'),
    needsClarification: z.boolean()
        .describe('Whether clarification is needed to determine platform'),
    message: z.string()
        .describe('Response message explaining the detection or asking for clarification'),
    suggestedOptions: z.array(z.string())
        .max(2)
        .describe('Short, direct platform options when clarification is needed')
});

const CACHED_SYSTEM_PROMPT = `You are Qirata's platform detection AI. Analyze user messages to detect whether they want to create content for Twitter (X) or LinkedIn.

PLATFORM DETECTION RULES:
- Look for explicit mentions: Twitter, X, LinkedIn
- Consider context clues: professional content = LinkedIn, short/casual = Twitter
- Handle Arabic language platform names
- Set confidence score based on clarity of the message
- Ask for clarification when uncertain

RESPONSE GUIDELINES:
- If platform is clear (confidence > 0.7): Set platform and needsClarification=false
- If unclear (confidence < 0.7): Set platform=null, needsClarification=true, and provide clarifying message
- Provide short, direct Twitter and LinkedIn options when clarification is needed (max 2 options)
- Keep responses concise and helpful

SUPPORTED PLATFORMS: Twitter (X), LinkedIn

You must respond with a JSON object containing:
- platform: "twitter" or "linkedin" if detected, null if unclear
- confidence: a number between 0.0 and 1.0
- needsClarification: true if platform is unclear, false otherwise
- message: response message explaining detection or asking for clarification
- suggestedOptions: array of up to 2 platform options when clarification is needed`;

export default async function platformAgent(options: z.infer<typeof PlatformInput>): Promise<z.infer<typeof PlatformOutput>> {
    // Initialize model
    const model = new ChatOpenAI({
        model: 'gpt-4.1-mini',
        temperature: 0,
        maxTokens: 250,
        openAIApiKey: process.env.OPENAI_API_KEY
    });

    // Create agent
    const agent = createAgent({
        model,
        tools: [],
        responseFormat: toolStrategy(PlatformOutput)
    });

    const result = await agent.invoke({
        messages: buildMessagesArray(options)
    }, {
        callbacks: [
            createDebugCallback('platform')
        ]
    });

    // Validate with Zod and return
    return result.structuredResponse;
}

function buildMessagesArray(options: z.infer<typeof PlatformInput>): BaseMessage[] {
    const messages: BaseMessage[] = [];
    messages.push(new SystemMessage(CACHED_SYSTEM_PROMPT));

    if (options.lastMessages.length > 0) {
        messages.push(new AIMessage('Previous conversation messages for context:'));
        options.lastMessages.forEach((msg) => {
            messages.push(new HumanMessage(msg));
        });
    }

    // Confirm receiving the old messages
    messages.push(new AIMessage('I have the context and will detect the platform.'));

    messages.push(new HumanMessage(options.message));

    return messages;
}
