import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOllama } from '@langchain/ollama';
import { z } from 'zod';
import { Message } from '../../../entities';
import { createDebugCallback } from '../../../utils/debug-callback';
import { logger } from '../../../utils/logger';

const KEEP_RECENT = 5; // Keep last 5 user messages for context

// Zod schema for platform detection response
const PlatformDetectionSchema = z.object({
    platform: z.enum(['twitter', 'linkedin', 'facebook', 'instagram']).nullable(),
    confidence: z.number().min(0).max(1),
    needsClarification: z.boolean(),
    reasoning: z.string(),
    clarificationQuery: z.string().optional().describe('Question to ask user when clarification is needed')
});

export type PlatformDetectionResponse = z.infer<typeof PlatformDetectionSchema>;

// Static system message (cacheable)
const SYSTEM_MESSAGE = `You are an expert social media platform detection assistant. Your role is to identify which social media platform a user wants to create content for.

## Available Platforms:
- **twitter**: Short-form content, tweets, microblogging (280 characters)
- **linkedin**: Professional networking, business content, career-focused
- **facebook**: Community engagement, personal and business posts, longer content
- **instagram**: Visual content, photos, stories, reels, lifestyle content

## Platform Keywords & Recognition:
**Twitter/X**: twitter, tweet, x.com, x post, تويتر, تغريدة
**LinkedIn**: linkedin, لينكد إن
**Facebook**: facebook, fb, فيسبوك
**Instagram**: instagram, insta, ig, انستغرام, انستا

## Detection Rules:
1. **Priority to Latest Message**: Always prioritize the user's most recent message for platform detection
2. **Smart Pattern Matching**:
   - Match complete words: "twitter" → twitter
   - Match partial words: "twit", "linke", "face", "insta" → respective platforms
   - Match abbreviations: "x", "fb", "ig" → respective platforms
   - Match similar spellings: "twiter", "linkdin", "instgram" → respective platforms
   - Match different cases: "TWITTER", "LinkedIn", "facebook" → respective platforms
3. **Context Analysis**: Only use conversation history when the latest message is unclear
4. **Confidence Scoring**:
   - 0.9-1.0: Exact match or clear abbreviation
   - 0.7-0.8: Partial match or similar spelling
   - 0.5-0.6: Contextual indication
   - 0.0-0.4: Unclear, needs clarification
5. **Clarification Strategy**: When confidence < 0.5, ask user to specify platform

## Response Guidelines:
- Set \`needsClarification: true\` when confidence < 0.5
- Generate helpful \`clarificationQuery\` when clarification needed
- Include available platform options in clarification
- Be conversational and helpful in queries`;

interface PlatformDetectionOptions {
    model?: ChatOllama;
    userMessage: string;
    conversationHistory?: Message[];
}

export async function detectPlatform(options: PlatformDetectionOptions): Promise<PlatformDetectionResponse> {
    const {
        model = new ChatOllama({ baseUrl: 'http://localhost:11434', model: 'mistral:7b', temperature: 0.3 }),
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