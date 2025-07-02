import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOllama } from '@langchain/ollama';
import { z } from 'zod';
import { Message } from '../../../entities';
import { DEFAULT_MODEL_CONFIGS, createModelFromConfig } from '../../../types/model-config.types';
import { logger } from '../../../utils/logger';
import { createDebugCallback } from '../../../utils/debug-callback';

const KEEP_RECENT = 3; // Keep last 3 messages for context

// Zod schema for structured AI response
const IntentDetectionSchema = z.object({
    intent: z.enum(['social', 'question']).describe('The detected user intent'),
    confidence: z.number().min(0.1).max(1.0).describe('Confidence score between 0.1 and 1.0'),
    reasoning: z.string().describe('Brief explanation of why this intent was chosen')
});

export type IntentDetectionResponse = z.infer<typeof IntentDetectionSchema>;

// Static system message (cacheable)
const SYSTEM_MESSAGE = `You are an AI assistant specialized in analyzing user messages to determine their intent. Your role is to classify whether a user wants to create social media content or ask questions.

## Intent Categories:
1. **social**: User wants to create, write, generate, compose, or draft social media content (posts, tweets, LinkedIn updates, etc.)
2. **question**: User wants to ask questions, get information, seek clarification, or request explanations

## Detection Guidelines:

### Social Post Intent Keywords:
- **Creation verbs**: create, write, generate, compose, draft, make, produce
- **Publishing terms**: post, share, publish, tweet, update
- **Platform mentions**: Twitter, LinkedIn, Facebook, Instagram, social media
- **Content types**: post, tweet, update, content, caption

### Question Intent Indicators:
- **Question words**: what, how, why, when, where, who, which
- **Information seeking**: explain, tell me, clarify, help me understand
- **Request patterns**: can you, could you, would you, please

### Context-Aware Rules:
1. **Priority to Latest Message**: Focus primarily on the user's most recent message
2. **Platform Context**: If previous messages discuss social platforms and current message mentions a platform → likely "social"
3. **Conversation Flow**: If conversation is about content creation and user provides brief responses → likely "social"
4. **Clarification Responses**: If previous message asked about platform preference and current message contains platform name → "social"

### Confidence Scoring:
- **0.9-1.0**: Clear intent keywords and context
- **0.7-0.8**: Strong indication with good context
- **0.5-0.6**: Moderate indication, some ambiguity
- **0.3-0.4**: Weak indication, high uncertainty

### Default Behavior:
- When unclear or ambiguous → default to "question"
- Provide clear reasoning for your decision`;

interface IntentDetectionOptions {
    model?: ChatOllama;
    message: string;
    conversationHistory?: Message[];
}

export async function detectIntent(options: IntentDetectionOptions): Promise<IntentDetectionResponse> {
    const {
        model = new ChatOllama({ baseUrl: 'http://localhost:11434', model: 'mistral:7b', temperature: 0.7 }),
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
            intent: 'question',
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