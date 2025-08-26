import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { Message } from '../../../entities';
import { createDebugCallback } from '../../../utils/debug-callback';
import { AILogger } from '../utils/ai-logger';

// Note: Conversation history length is controlled by the caller

// Zod schema for structured AI response
const IntentDetectionSchema = z.object({
    intent: z.enum(['social', 'conversation']).describe('The detected user intent'),
    confidence: z.number().min(0.1).max(1.0).describe('Confidence score between 0.1 and 1.0'),
    reasoning: z.string().describe('Brief explanation of why this intent was chosen')
});

export type IntentDetectionResponse = z.infer<typeof IntentDetectionSchema>;

// Static system message (cacheable)
const SYSTEM_MESSAGE = `You are ONLY an intent classifier. Your job is to classify user messages into exactly 2 categories:

**social**: User wants to create or modify social media content (posts, tweets, updates)
**conversation**: User wants to have a conversation, ask questions, or get information

CLASSIFICATION RULES:
1. Look at the LATEST user message to classify
2. Use context of previous user messages to understand references
3. If the user is asking to modify/add/remove something that was previously about content creation → "social"
4. If the user is asking questions, seeking explanations, or having discussions → "conversation"
5. When in doubt → "conversation"
6. Make sure to always return confidence between 0.1 and 1.0
7. Provide a brief reasoning for your choice

CRITICAL: Do NOT generate any content. Only classify intent and provide reasoning. Be concise and accurate.`;

interface IntentDetectionOptions {
    model?: ChatOllama | ChatOpenAI; // Allow both Ollama and OpenAI models
    message: string;
    conversationHistory?: Message[];
}

export async function detectIntent(options: IntentDetectionOptions): Promise<IntentDetectionResponse> {
    const {
        model = new ChatOpenAI({ 
            model: 'gpt-4.1-mini', 
            temperature: 0, 
            maxTokens: 150,
            openAIApiKey: process.env.OPENAI_API_KEY 
        }),
        message,
        conversationHistory
    } = options;

    try {
        AILogger.debug('Detecting user intent with AI');

        // Create structured output parser with Zod schema
        // Using type assertion to avoid TS2589 error with complex Zod schemas
        const parser = StructuredOutputParser.fromZodSchema(IntentDetectionSchema as any);

        // Build messages array with conversation history
        const messages = buildMessagesArray(conversationHistory || [], message, parser.getFormatInstructions());

        const prompt = ChatPromptTemplate.fromMessages(messages);
        const chain = prompt.pipe(model).pipe(parser);

        // Create debug callback
        const debugCallback = createDebugCallback('intent-detection');

        const response = await chain.invoke({}, {
            callbacks: [debugCallback]
        });

        return response as IntentDetectionResponse;

    } catch (error) {
        AILogger.error('Intent detection failed', error);

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

    messages.push(new HumanMessage(`<FORMAT_INSTRUCTIONS>\n${formatInstructions}</FORMAT_INSTRUCTIONS>`));
    messages.push(new AIMessage('I understand. I will ONLY classify the user message intent as either "social" or "conversation" using the exact JSON format specified. I will NOT generate any content, code, or posts - only intent classification with confidence and reasoning.'));

    // Add only user messages for context (no AI responses to avoid confusion)
    for (const msg of conversationHistory) {
        if (msg.user_message?.trim()) {
            messages.push(new HumanMessage(msg.user_message));
        }
    }

    // Current user message
    messages.push(new HumanMessage(currentUserMessage));

    return messages;
}