import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatOllama } from '@langchain/ollama';
import { SocialPlatform } from '../../entities/social-post.entity';
import {
    AIContext,
    AIStreamCallback,
    LangChainServiceConfig,
    StreamingAIResponse
} from '../../types/ai.types';
import { logger } from '../../utils/logger';
import { IntentDetectionService } from './intent-detection.service';
import { MemoryService } from './memory.service';
import { socialPostGeneratorService } from './social-post-generator.service';
import { PlatformDetectionService } from './platform-detection.service';

// Custom WebSocket streaming callback handler
class WebSocketStreamCallback extends BaseCallbackHandler {
    name = 'websocket_stream_callback';

    constructor(
        private sessionId: string,
        private streamCallback: AIStreamCallback
    ) {
        super();
    }

    async handleLLMStart(): Promise<void> {
        this.streamCallback({
            event: 'start',
            sessionId: this.sessionId
        });
    }

    async handleLLMNewToken(token: string): Promise<void> {
        this.streamCallback({
            event: 'token',
            token,
            sessionId: this.sessionId
        });
    }

    async handleLLMEnd(): Promise<void> {
        this.streamCallback({
            event: 'end',
            sessionId: this.sessionId
        });
    }

    async handleLLMError(error: Error): Promise<void> {
        this.streamCallback({
            event: 'error',
            error: error.message,
            sessionId: this.sessionId
        });
    }
}

export class LangChainService {
    private chatModel!: ChatOllama;
    private config: LangChainServiceConfig;
    private cleanupInterval!: NodeJS.Timeout;
    private platformDetectionService!: PlatformDetectionService;
    private intentService!: IntentDetectionService;
    private memoryService!: MemoryService;

    constructor() {
        this.config = {
            ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
            model: process.env.OLLAMA_MODEL || 'mistral:7b',
            maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2048'),
            temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
            memoryTokenLimit: parseInt(process.env.AI_MEMORY_TOKEN_LIMIT || '1000'),
            sessionCleanupInterval: parseInt(process.env.AI_SESSION_CLEANUP_MINUTES || '30')
        };

        this.chatModel = new ChatOllama({
            baseUrl: this.config.ollamaUrl,
            model: this.config.model,
            temperature: this.config.temperature,
        });

        this.startSessionCleanup();

        this.intentService = new IntentDetectionService(this.chatModel);
        this.memoryService = new MemoryService(this.chatModel);
        this.platformDetectionService = new PlatformDetectionService(this.chatModel);
    }


    public async streamMessage(
        message: string,
        sessionId: string,
        context: AIContext,
        streamCallback: AIStreamCallback
    ): Promise<StreamingAIResponse> {
        try {
            const startTime = Date.now();

            // Detect user intent with conversation context
            const intentResult = await this.intentService.detectIntent(message, context.previousMessages);
            logger.info(`Detected intent: ${intentResult.intent.type} for session ${sessionId}`);

            // Get or create session memory (for tracking purposes)
            const memory = await this.memoryService.getOrCreateMemory(sessionId, context.previousMessages, context.conversationSummary);

            // Create callback handler if streaming is requested
            const callbacks = streamCallback ? [
                new WebSocketStreamCallback(sessionId, streamCallback)
            ] : [];

            // Get the prompt Template
            const promptTemplate = await this.buildPromptTemplate(intentResult.intent.type, context, message);

            // Build Runnable sequence pipeline
            const chain = RunnableSequence.from([
                // Step 1: Prepare all context variables
                {
                    userMessage: (input: any) => input.message,
                    postContent: () => context.postContent || 'No post content provided',
                    chatHistory: async () => {
                        const messages = await memory.chatHistory.getMessages();
                        return messages;
                    },
                    conversationSummary: () => memory.movingSummaryBuffer || '',
                    userPreferences: () => socialPostGeneratorService.buildUserPreferencesContext(context)
                },
                // Step 2: provide the template
                promptTemplate,
                // Step 3: provider the model
                this.chatModel,
                // Step 4 parese the output
                new StringOutputParser()
            ]);

            const response = await chain.invoke({ message }, { callbacks });

            // Update memory
            this.memoryService.saveContext(sessionId, message, response);

            const processingTime = Date.now() - startTime;

            logger.info(`AI response generated for session ${sessionId} in ${processingTime}ms`);

            let isSocialPost = false;
            let socialPlatform: SocialPlatform | undefined;
            if (intentResult.intent.type === 'social_post') {
                const detectedPlatform = await this.platformDetectionService.detectPlatform({
                    userMessage: message,
                    conversationHistory: context.previousMessages
                });
                if (detectedPlatform && detectedPlatform.confidence >= 0.8) {
                    isSocialPost = true;
                    socialPlatform = detectedPlatform.platform;
                }
            }

            return {
                sessionId,
                isComplete: true,
                content: response,
                summary: memory.movingSummaryBuffer,
                isSocialPost,
                socialPlatform,
            };
        } catch (error) {
            logger.error(`Error processing message for session ${sessionId}:`, error);

            if (streamCallback) {
                streamCallback({
                    event: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    sessionId
                });
            }

            return {
                sessionId,
                isComplete: true,
                content: '',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    private async buildPromptTemplate(intentType: 'question' | 'social_post', context: AIContext, userMessage?: string): Promise<ChatPromptTemplate> {
        if (intentType == 'question') {
            return ChatPromptTemplate.fromMessages([
                ['system', `You are an intelligent AI assistant that helps users understand and discuss content. You have access to both the original post content and the conversation history. Use this context to provide helpful, accurate, and relevant responses.

## Post Content:
{postContent}

## Previous Conversation Summary:
{conversationSummary}

## Instructions:
- Answer questions based on the post content AND the conversation history
- Reference previous messages when relevant (e.g., "As I mentioned earlier...", "Building on what we discussed...")
- If the user asks about "the previous message" or "what you said before", refer to the chat history
- If the user asks for explanations about points from previous responses, provide detailed clarifications
- If the user asks about something not covered in either the post or conversation, clearly state that
- Maintain conversational context and continuity
- Be conversational and helpful, treating this as an ongoing discussion

## Examples of conversational responses:
- "Earlier I mentioned X, let me elaborate on that..."
- "Building on our previous discussion about Y..."
- "To clarify the point I made about Z..."
- "As we discussed, the main idea is..."

Remember: You can reference both the original post content and our entire conversation history to provide contextual, meaningful responses.`],
                new MessagesPlaceholder('chatHistory'),
                ['human', '{userMessage}']
            ])
        } else {
            // Enhanced social post handling
            return await this.buildSocialPostPromptTemplate(context, userMessage);
        }
    }

    private async buildSocialPostPromptTemplate(context: AIContext, userMessage?: string): Promise<ChatPromptTemplate> {
        // Detect platform from current user message with conversation context
        const platformDetection = await this.platformDetectionService.detectPlatform({
            userMessage: userMessage || '',
            conversationHistory: context.previousMessages
        });

        console.log('Platform detection result:', platformDetection);
        if (platformDetection.needsClarification) {
            // User hasn't specified platform - ask for clarification
            return socialPostGeneratorService.buildPlatformClarificationPromptTemplate();
        } else {
            // Platform detected - generate platform-specific post
            return socialPostGeneratorService.buildSocialPostPromptTemplate(platformDetection.platform!);
        }
    }


    private buildPreferenceContext(preferences: any): string {
        const details: string[] = [];

        if (preferences.voice) {
            const voiceDescriptions: Record<string, string> = {
                professional: 'Use professional, authoritative language',
                friendly: 'Write in a warm, approachable tone',
                direct: 'Be straightforward and concise',
                storyteller: 'Use narrative elements and engaging storytelling'
            };
            const voice = String(preferences.voice);
            details.push(`Voice: ${voiceDescriptions[voice] || voice}`);
        }

        if (preferences.contentStyle) {
            const styleDescriptions: Record<string, string> = {
                'data-driven': 'Focus on facts, statistics, and evidence-based content',
                'practical': 'Emphasize actionable insights and practical advice',
                'thought-provoking': 'Challenge conventional thinking and spark discussion'
            };
            const contentStyle = String(preferences.contentStyle);
            details.push(`Style: ${styleDescriptions[contentStyle] || contentStyle}`);
        }

        if (preferences.hookPreference) {
            const hookDescriptions: Record<string, string> = {
                'questions': 'Start with engaging questions to hook readers',
                'observations': 'Begin with interesting observations or insights',
                'bold-claims': 'Open with strong, attention-grabbing statements'
            };
            const hookPreference = String(preferences.hookPreference);
            details.push(`Hook: ${hookDescriptions[hookPreference] || hookPreference}`);
        }

        return details.length > 0 ? details.join('. ') + '.' : '';
    }


    private estimateTokenCount(text: string): number {
        // Rough estimation: 1 token ≈ 4 characters for English text
        return Math.ceil(text.length / 4);
    }

    private startSessionCleanup(): void {
        const intervalMs = this.config.sessionCleanupInterval * 60 * 1000;

        this.cleanupInterval = setInterval(() => {
            this.memoryService.cleanupInactiveSessions();
        }, intervalMs);

        logger.info(`Session cleanup started with ${this.config.sessionCleanupInterval} minute intervals`);
    }

    public async testConnection(): Promise<boolean> {
        try {
            const response = await this.chatModel.invoke("Test connection");
            logger.info('LangChain service connection test successful');
            return true;
        } catch (error) {
            logger.error('LangChain service connection test failed:', error);
            return false;
        }
    }

    public destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        logger.info('LangChain service destroyed');
    }
}

// Export singleton instance
export const langChainService = new LangChainService();
