import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { createDebugCallback } from '../../../utils/debug-callback';

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
        .describe('Suggested platform options when clarification is needed')
});

const SYSTEM_PROMPT = `You are Qirata's platform detection AI. Analyze user messages to detect whether they want to create content for Twitter (X) or LinkedIn.

PLATFORM DETECTION RULES:
- Look for explicit mentions: Twitter, X, LinkedIn
- Consider context clues: professional content = LinkedIn, short/casual = Twitter
- Handle Arabic language platform names
- Set confidence score based on clarity of the message
- Ask for clarification when uncertain

RESPONSE GUIDELINES:
- If platform is clear (confidence > 0.7): Confirm the detected platform
- If unclear (confidence < 0.7): Ask for clarification with both options
- Provide Twitter and LinkedIn as suggested options when clarification is needed
- Keep responses concise and helpful

SUPPORTED PLATFORMS: Twitter (X), LinkedIn`;

export async function platformAgent(options: z.infer<typeof PlatformInput>): Promise<z.infer<typeof PlatformOutput>> {
    const platformTool = {
        name: "platformResponse",
        description: "Detect social media platform from user message",
        schema: zodToJsonSchema(PlatformOutput)
    };

    const model = new ChatOpenAI({
        model: 'gpt-4.1-mini',
        temperature: 0.1,
        maxTokens: 300,
        openAIApiKey: process.env.OPENAI_API_KEY
    }).bindTools([platformTool]);

    // Build conversation context
    const conversationContext = options.lastMessages.length > 0
        ? `\nPrevious user messages: ${options.lastMessages.join(' → ')}`
        : '\nThis is a new platform detection request.';

    const messages = [
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(`${conversationContext}

Current message: "${options.message}"

Analyze this message to detect whether the user wants Twitter (X) or LinkedIn, and respond accordingly.`)
    ];

    const result = await model.invoke(messages, {
        callbacks: [
            createDebugCallback('platform')
        ]
    });

    // Extract tool call result
    const toolCall = result.tool_calls?.[0];
    if (!toolCall) {
        throw new Error('No tool call found in response');
    }

    // Validate with Zod and return
    return PlatformOutput.parse(toolCall.args);
}