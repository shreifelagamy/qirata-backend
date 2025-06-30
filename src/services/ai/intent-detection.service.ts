import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { IntentDetectionResult, UserIntent } from '../../types/ai.types';
import { logger } from '../../utils/logger';

// Zod schema for structured AI response
const IntentDetectionSchema = z.object({
    intent: z.enum(['social_post', 'question']).describe('The detected user intent'),
    confidence: z.number().min(0.1).max(1.0).describe('Confidence score between 0.1 and 1.0'),
    reasoning: z.string().describe('Brief explanation of why this intent was chosen')
});

type IntentDetectionAIResponse = z.infer<typeof IntentDetectionSchema>;

export interface ChatModel {
    invoke(prompt: any): Promise<any>;
}

export class IntentDetectionService {
    private readonly outputParser: StructuredOutputParser<typeof IntentDetectionSchema>;
    // Intent detection keywords for fallback
    private readonly socialPostKeywords = [
        'create', 'write', 'generate', 'post', 'tweet', 'linkedin',
        'compose', 'draft', 'publish', 'share', 'social'
    ];

    constructor(private model: ChatModel) {
        // Initialize the structured output parser with the Zod schema
        this.outputParser = StructuredOutputParser.fromZodSchema(IntentDetectionSchema);
    }

    /**
     * Main intent detection method
     */
    async detectIntent(message: string, conversationHistory?: any[]): Promise<IntentDetectionResult> {
        return await this.detectWithAI(message, conversationHistory);
    }

    /**
     * AI-powered intent detection using StructuredOutputParser with Zod
     */
    private async detectWithAI(message: string, conversationHistory?: any[]): Promise<IntentDetectionResult> {
        try {
            // Get format instructions from the parser
            const formatInstructions = this.outputParser.getFormatInstructions();

            // Build conversation context
            const conversationContext = this.buildConversationContext(conversationHistory);

            // Create intent detection prompt template with structured output and context
            const intentPromptTemplate = ChatPromptTemplate.fromMessages([
                ["system", `You are an AI assistant specialized in analyzing user messages to determine their intent.
                You must respond in the exact format specified below.

                IMPORTANT: Consider the conversation history to understand context. If the user is responding to a previous question about social media platforms or continuing a social post creation flow, prioritize "social_post" intent.`],
                ["human", `Analyze this user message and determine their intent:

Current User Message: "{userMessage}"

Conversation Context:
{conversationContext}

Determine if the user wants to:
1. "social_post" - Create, write, generate, compose, or draft social media content (posts, tweets, LinkedIn updates, etc.)
2. "question" - Ask questions, get information, seek clarification, or request explanations

Guidelines:
- If the message contains requests to create, write, generate, compose, draft, post, share, or publish content → "social_post"
- If the message asks questions, seeks information, or requests explanations → "question"
- **CONTEXT-AWARE RULES:**
  - If previous messages mention social media platforms or post creation, and current message mentions a platform (Twitter, LinkedIn, Facebook, Instagram) → "social_post"
  - If previous message asked about platform preference and current message contains a platform name → "social_post"
  - If conversation is about creating social content and user provides brief responses → likely "social_post"
- If unclear, default to "question"

{formatInstructions}`]
            ]);

            // Format the prompt with the user message, context, and format instructions
            const formattedPrompt = await intentPromptTemplate.formatMessages({
                userMessage: message,
                conversationContext,
                formatInstructions
            });

            // Get AI response for intent detection
            const response = await this.model.invoke(formattedPrompt);
            const aiResponse = response.content as string;

            // Parse response using structured output parser
            const parsed = await this.outputParser.parse(aiResponse) as IntentDetectionAIResponse;
            console.log('Parsed AI Response:', parsed);

            // Validate and structure the response
            const intent: UserIntent = {
                type: parsed.intent,
                confidence: parsed.confidence,
                keywords: [] // AI doesn't use keywords, but keep for compatibility
            };

            logger.debug(`AI Intent Detection - Message: "${message}" → Intent: ${intent.type} (${intent.confidence}) - Reasoning: ${parsed.reasoning}`);

            return {
                intent,
                detectedKeywords: [],
                rawMessage: message,
                aiReasoning: parsed.reasoning
            };

        } catch (error) {
            logger.error('AI intent detection failed, falling back to keyword-based detection:', error);
            return this.detectWithKeywords(message, conversationHistory);
        }
    }

    /**
     * Build conversation context for intent detection
     */
    private buildConversationContext(conversationHistory?: any[]): string {
        if (!conversationHistory || conversationHistory.length === 0) {
            return 'No previous conversation context.';
        }

        // Get last 3 messages for context (avoid too much noise)
        const recentMessages = conversationHistory.slice(-3);
        
        const contextLines: string[] = [];
        recentMessages.forEach((msg, index) => {
            const role = msg.role || (index % 2 === 0 ? 'user' : 'assistant');
            const content = msg.content || msg.message || '';
            contextLines.push(`${role}: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`);
        });

        return contextLines.join('\n');
    }

    /**
     * Fallback keyword-based intent detection with context awareness
     */
    private detectWithKeywords(message: string, conversationHistory?: any[]): IntentDetectionResult {
        const lowerMessage = message.toLowerCase();
        const words = lowerMessage.split(/\s+/);

        const detectedKeywords = this.socialPostKeywords.filter(keyword =>
            words.includes(keyword) || lowerMessage.includes(keyword)
        );

        // Check for platform mentions in a social post context
        const platformKeywords = ['twitter', 'linkedin', 'facebook', 'instagram'];
        const containsPlatform = platformKeywords.some(platform => lowerMessage.includes(platform));
        
        // Check if previous conversation mentions social posts or platform selection
        const contextualClues = this.checkConversationContext(conversationHistory);
        
        let isSocialPost = detectedKeywords.length > 0;
        
        // Context-aware enhancement
        if (!isSocialPost && containsPlatform && contextualClues.hasSocialPostContext) {
            // User mentioned a platform after social post discussion
            isSocialPost = true;
            detectedKeywords.push('platform_selection');
        }

        const confidence = isSocialPost ?
            Math.min(0.9, 0.3 + (detectedKeywords.length * 0.15) + (contextualClues.hasSocialPostContext ? 0.2 : 0)) : 0.8;

        const intent: UserIntent = {
            type: isSocialPost ? 'social_post' : 'question',
            confidence,
            keywords: detectedKeywords
        };

        logger.debug(`Keyword Intent Detection - Message: "${message}" → Intent: ${intent.type} (${intent.confidence})`);

        return {
            intent,
            detectedKeywords,
            rawMessage: message
        };
    }

    /**
     * Check conversation history for social post context
     */
    private checkConversationContext(conversationHistory?: any[]): { hasSocialPostContext: boolean; hasRecentPlatformQuestion: boolean } {
        if (!conversationHistory || conversationHistory.length === 0) {
            return { hasSocialPostContext: false, hasRecentPlatformQuestion: false };
        }

        const recentMessages = conversationHistory.slice(-5); // Check last 5 messages
        
        const hasSocialPostContext = recentMessages.some(msg => {
            const content = (msg.content || msg.message || '').toLowerCase();
            return content.includes('social post') || 
                   content.includes('create a post') ||
                   content.includes('generate') && (content.includes('post') || content.includes('content')) ||
                   content.includes('share on social') ||
                   content.includes('platform would you like');
        });

        const hasRecentPlatformQuestion = recentMessages.some(msg => {
            const content = (msg.content || msg.message || '').toLowerCase();
            return content.includes('which platform') ||
                   content.includes('available platforms') ||
                   content.includes('twitter') || content.includes('linkedin') || 
                   content.includes('facebook') || content.includes('instagram');
        });

        return { hasSocialPostContext, hasRecentPlatformQuestion };
    }
}