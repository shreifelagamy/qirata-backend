import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOllama } from '@langchain/ollama';
import { z } from 'zod';
import { Message } from '../../../entities';
import { createDebugCallback } from '../../../utils/debug-callback';
import { logger } from '../../../utils/logger';
import { ChatOpenAI } from '@langchain/openai';

const KEEP_RECENT = 5; // Keep last 5 user messages for context

// Zod schema for platform detection response
const PlatformDetectionSchema = z.object({
    platform: z.enum(['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'])
        .nullable()
        .describe('The detected social media platform where user wants to share content. Null if no platform could be determined with reasonable confidence'),

    confidence: z.number()
        .min(0)
        .max(1)
        .describe('Confidence score from 0.0 to 1.0 indicating how certain the agent is about the platform detection. Higher values mean more certainty'),

    needsClarification: z.boolean()
        .describe('Whether the user input requires clarification to determine the platform. Set to true when both current message and conversation context are unclear or ambiguous'),

    reasoning: z.string()
        .min(1)
        .describe('Brief explanation of why this platform was chosen or why clarification is needed. Should consider both current message and conversation context'),

    clarificationQuery: z.string()
        .nullable()
        .describe('Specific question to ask the user when clarification is needed. Should be present when needsClarification is true. Example: "Which platform would you like to share this on - Twitter, LinkedIn, or Instagram?"')
});

export type PlatformDetectionResponse = z.infer<typeof PlatformDetectionSchema>;

// Static system message (cacheable)
const SYSTEM_MESSAGE = `Analyze the user message to detect which social media platform they want.

CONSIDERATIONS:
- USER MIGHT SAY PARTIAL NAMES, ABBREVIATIONS, OR COMMON TERMS
- USER MIGHT USE ARABIC LANGUAGE
- TWITTER MIGHT BE REFERRED TO AS "X"

RULES:
- IGNORE CASE SENSITIVITY WHEN MATCHING PLATFORM NAMES
- MUST SET YOUR CONFIDENCE SCORE BETWEEN 0.0 AND 1.0
- MUST CLARIFY YOUR REASON FOR THE PLATFORM CHOICE
- DONT TAKE GUESSES, IF UNCLEAR, ASK FOR CLARIFICATION
`;

interface PlatformDetectionOptions {
    model?: ChatOllama | ChatOpenAI; // Allow both Ollama and OpenAI models
    userMessage: string;
    conversationHistory?: Message[];
}

export async function detectPlatform(options: PlatformDetectionOptions): Promise<PlatformDetectionResponse> {
    const {
        model = new ChatOpenAI({ model: 'gpt-4.1-mini', temperature: 0.1, openAIApiKey: process.env.OPENAI_API_KEY }),
        userMessage,
        conversationHistory
    } = options;

    try {
        logger.info('Detecting social media platform with AI');

        // Create structured output parser with Zod schema
        const parser = StructuredOutputParser.fromZodSchema(PlatformDetectionSchema);

        // Build messages array with conversation history
        const messages = buildMessagesArray(conversationHistory || [], userMessage, parser.getFormatInstructions());

        const prompt = ChatPromptTemplate.fromMessages(messages);
        const chain = prompt.pipe(model).pipe(parser);

        // Create debug callback
        const debugCallback = createDebugCallback('platform-detection');

        const response = await chain.invoke({}, {
            callbacks: [debugCallback]
        });

        logger.info('[PlatformDetection] AI detection result:', {
            platform: response.platform,
            confidence: response.confidence,
            needsClarification: response.needsClarification,
            reasoning: response.reasoning
        });

        return response;

    } catch (error) {
        logger.error('[PlatformDetection] AI detection failed:', error);
        // Fallback response when AI fails
        return {
            platform: null,
            confidence: 0,
            needsClarification: true,
            reasoning: 'Platform detection failed, requesting user clarification',
            clarificationQuery: "I'd be happy to help create your social media post! Which platform would you like this optimized for? (Twitter, LinkedIn, Facebook, or Instagram)"
        };
    }
}

// Helper function to build messages array for prompt
function buildMessagesArray(conversationHistory: Message[], currentUserMessage: string, formatInstructions: string): BaseMessage[] {
    const messages: BaseMessage[] = [];

    // Static system message (cacheable)
    messages.push(new SystemMessage(SYSTEM_MESSAGE));

    // Add recent conversation history as separate messages
    const recentMessages = conversationHistory.slice(-KEEP_RECENT);

    for (const msg of recentMessages) {
        if (msg.user_message?.trim()) {
            messages.push(new HumanMessage(msg.user_message));
        }
        if (msg.ai_response?.trim()) {
            messages.push(new AIMessage(msg.ai_response))
        }
    }

    messages.push(new HumanMessage(`<FORMAT_INSTRUCTIONS>\n${formatInstructions}</FORMAT_INSTRUCTIONS>`));

    // Current user message with format instructions
    messages.push(new HumanMessage(currentUserMessage));

    return messages;
}