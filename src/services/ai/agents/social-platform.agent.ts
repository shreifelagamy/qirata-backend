import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

import { createAgent, toolStrategy } from 'langchain';
import { createDebugCallback } from '../../../utils/debug-callback';

// Input schema for platform detection
const SocialPlatformInput = z.object({
    message: z.string().describe('The current user message requesting platform detection'),
    lastMessages: z.array(z.string()).max(5).describe('Previous conversation messages for context'),
});

export const SocialPlatformList = z.enum(['twitter', 'linkedin']);

// Output schema for platform detection
export const SocialPlatformOutput = z.object({
    platform: SocialPlatformList
        .optional()
        .describe('The detected social media platform. Null if unclear'),
    message: z.string()
        .describe('Response message explaining the detection or asking for clarification'),
    suggestedOptions: z.array(z.string())
        .max(2)
        .describe('Short, direct platform options when clarification is needed')
});

const CACHED_SYSTEM_PROMPT = `You are Qirata's social platform detector.

Task: Determine whether the user wants to post on Twitter (X) or LinkedIn.

Output platform = "twitter" when:
- The user explicitly mentions Twitter, X, or tweet.

Output platform = "linkedin" when:
- The user explicitly mentions LinkedIn.

Output platform = null when:
- No platform is mentioned or it's ambiguous.

When platform is detected:
- Set message to a short confirmation (e.g. "Got it, creating for Twitter.").
- Set suggestedOptions to an empty array.

When platform is null:
- Set message to a short question asking which platform they want.
- Set suggestedOptions to ["Twitter", "LinkedIn"].

Rules:
- Only detect from explicit mentions. Do NOT guess based on content style.
- Handle Arabic platform names (e.g. تويتر, لينكدإن).
- Use conversation history for context (e.g. if they said "Twitter" earlier).`;

export default async function socialPlatformAgent(options: z.infer<typeof SocialPlatformInput>): Promise<z.infer<typeof SocialPlatformOutput>> {
    // Initialize model
    const model = new ChatOpenAI({
        model: 'gpt-5-mini',
        openAIApiKey: process.env.OPENAI_API_KEY
    });

    // Create agent
    const agent = createAgent({
        model,
        tools: [],
        responseFormat: toolStrategy(SocialPlatformOutput)
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

function buildMessagesArray(options: z.infer<typeof SocialPlatformInput>): BaseMessage[] {
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
