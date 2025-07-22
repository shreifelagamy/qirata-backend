import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { Message } from '../../../entities';
import { createDebugCallback } from '../../../utils/debug-callback';
import { logger } from '../../../utils/logger';

const KEEP_RECENT = 3; // Keep last 3 messages for context

// Zod schema for structured AI response
const IntentDetectionSchema = z.object({
    intent: z.enum(['social', 'conversation']).describe('The detected user intent'),
    confidence: z.number().min(0.1).max(1.0).describe('Confidence score between 0.1 and 1.0'),
    reasoning: z.string().describe('Brief explanation of why this intent was chosen')
});

export type IntentDetectionResponse = z.infer<typeof IntentDetectionSchema>;

// Static system message (cacheable)
const SYSTEM_MESSAGE = `You are an intent classifier. Classify user messages into exactly 2 categories:

**social**: User wants to create social media content (posts, tweets, updates)
**conversation**: User wants to have a conversation, ask questions, or get information

KEYWORDS:
- Social: create, write, generate, compose, draft, make, post, share, publish, tweet, Twitter, LinkedIn, Facebook, Instagram, اكتب، أنشئ، منشور، تغريدة، نشر، شارك، تويتر، لينكد إن، فيسبوك، انستغرام
- Conversation: what, how, why, when, where, who, which, explain, tell me, clarify, help, hello, hi, thanks, thank you, ما، كيف، لماذا، متى، أين، من، أي، اشرح، أخبرني، وضح، ساعد، مرحبا، شكرا

RULES:
1. Focus on the LATEST message
2. If unclear → choose "conversation"
3. Platform names → likely "social"
4. Questions, greetings, thanks, explanations → likely "conversation"
5. Make sure to always return confidence between 0.1 and 1.0
6. Provide a brief reasoning for your choice

Be concise and accurate.`;

interface IntentDetectionOptions {
    model?: ChatOllama | ChatOpenAI; // Allow both Ollama and OpenAI models
    message: string;
    conversationHistory?: Message[];
}

export async function detectIntent(options: IntentDetectionOptions): Promise<IntentDetectionResponse> {
    const {
        model = new ChatOpenAI({ model: 'gpt-4.1-mini', temperature: 0.1, openAIApiKey: process.env.OPENAI_API_KEY }),
        message,
        conversationHistory
    } = options;

    try {
        logger.info('Detecting user intent with AI');

        // Create structured output parser with Zod schema
        const parser = StructuredOutputParser.fromZodSchema(IntentDetectionSchema);

        // Build messages array with conversation history
        const messages = buildMessagesArray(conversationHistory || [], message, parser.getFormatInstructions());

        const prompt = ChatPromptTemplate.fromMessages(messages);
        const chain = prompt.pipe(model).pipe(parser);

        // Create debug callback
        const debugCallback = createDebugCallback('intent-detection');

        const response = await chain.invoke({}, {
            callbacks: [debugCallback]
        });

        return response;

    } catch (error) {
        logger.error('AI intent detection failed:', error);

        // Return fallback response
        return {
            intent: 'conversation',
            confidence: 0.5,
            reasoning: 'Intent detection failed, defaulting to question'
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
            messages.push(new AIMessage(msg.ai_response));
        }
    }

    // Add format instructions as a separate message
    messages.push(new HumanMessage(`<FORMAT_INSTRUCTIONS>\n${formatInstructions}</FORMAT_INSTRUCTIONS>`));

    // Current user message
    messages.push(new HumanMessage(currentUserMessage));

    return messages;
}