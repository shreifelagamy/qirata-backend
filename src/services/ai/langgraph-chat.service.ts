import { ChatOllama } from '@langchain/ollama';
import { SocialPlatform } from '../../entities/social-post.entity';
import {
    AIContext,
    AIResponse,
    AIStreamCallback,
    StreamingAIResponse
} from '../../types/ai.types';
import { logger } from '../../utils/logger';
import { IntentDetectionService } from './intent-detection.service';
import { MemoryService } from './memory.service';
import { SocialPostGeneratorService } from './social-post-generator.service';
import { PlatformDetectionService } from './platform-detection.service';
import { WorkflowBuilder } from './langgraph/builders/workflow-builder';
import { ChatState } from './langgraph/nodes/base-node';
import fs from 'fs';



export class LangGraphChatService {
    private app: any;
    private activeRequests = new Map<string, AbortController>();

    private chatModel: ChatOllama;
    private intentService: IntentDetectionService;
    private socialPostGeneratorService: SocialPostGeneratorService;
    private platformDetectionService: PlatformDetectionService;
    private memoryService: MemoryService;
    private workflowBuilder: WorkflowBuilder;

    constructor() {
        // Initialize chat model
        this.chatModel = new ChatOllama({
            baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
            model: process.env.OLLAMA_MODEL || 'mistral:7b',
            temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
        });

        // Initialize services
        this.intentService = new IntentDetectionService(this.chatModel);
        this.socialPostGeneratorService = new SocialPostGeneratorService();
        this.platformDetectionService = new PlatformDetectionService(this.chatModel);
        this.memoryService = new MemoryService(this.chatModel);

        // Initialize workflow builder
        this.workflowBuilder = new WorkflowBuilder(
            this.chatModel,
            this.intentService,
            this.socialPostGeneratorService,
            this.platformDetectionService,
            this.memoryService
        );

        this.app = this.workflowBuilder.buildWorkflow();
    }


    private estimateTokenCount(text: string): number {
        return Math.ceil(text.length / 4);
    }

    // Public API Methods

    /**
     * Process a message through the LangGraph workflow
     */
    public async processMessage(
        message: string,
        sessionId: string,
        context: AIContext,
        streamCallback?: AIStreamCallback
    ): Promise<StreamingAIResponse> {
        try {
            const startTime = Date.now();

            // Generate visual representation
            const graphBlob = await this.app.getGraph().drawMermaidPng();
            const graphBuffer = Buffer.from(await graphBlob.arrayBuffer());
            fs.writeFileSync('graph.png', graphBuffer);


            // Cancel any existing request for this session
            this.cancelExistingRequest(sessionId);

            const abortController = new AbortController();
            this.activeRequests.set(sessionId, abortController);

            const config = {
                configurable: {
                    thread_id: sessionId,
                    session_id: sessionId
                },
                signal: abortController.signal,
            };

            const initialState: ChatState = {
                sessionId,
                userMessage: message,
                postContent: context.postContent,
                previousMessages: context.previousMessages,
                conversationSummary: context.conversationSummary,
                userPreferences: context.userPreferences,
                callback: streamCallback,
            };

            logger.info(`[LangGraph] Starting workflow for session: ${sessionId}`);

            if (streamCallback) {
                streamCallback({
                    event: 'start',
                    sessionId
                });
            }

            // Execute the workflow
            const result = await this.app.invoke(initialState, config);

            // Clean up
            this.activeRequests.delete(sessionId);

            const response: StreamingAIResponse = {
                sessionId: result.sessionId,
                isComplete: true,
                content: result.aiResponse || 'No response generated',
                error: result.error,
                summary: this.memoryService.getMovingSummary(sessionId),
                isSocialPost: result.isSocialPost || false,
                socialPlatform: result.socialPlatform
            };

            logger.info(`[LangGraph] Workflow completed for session: ${sessionId} in ${Date.now() - startTime}ms`);
            return response;

        } catch (error) {
            // Clean up on error
            this.activeRequests.delete(sessionId);

            logger.error('[LangGraph] Workflow execution error:', error);

            if (streamCallback) {
                streamCallback({
                    event: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    sessionId
                });
            }

            if (error instanceof Error && error.name === 'AbortError') {
                return {
                    sessionId,
                    isComplete: true,
                    content: '',
                    error: 'Request was cancelled'
                };
            }

            return {
                sessionId,
                isComplete: true,
                content: '',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Process message and return AIResponse format (for compatibility)
     */
    public async processMessageForResponse(
        message: string,
        sessionId: string,
        context: AIContext
    ): Promise<AIResponse> {
        const streamingResponse = await this.processMessage(message, sessionId, context);

        return {
            content: streamingResponse.content,
            intent: { type: streamingResponse.isSocialPost ? 'social_post' : 'question', confidence: 0.9, keywords: [] },
            sessionId: streamingResponse.sessionId,
            tokenCount: this.estimateTokenCount(streamingResponse.content),
            processingTime: 0
        };
    }

    /**
     * Cancel existing request for a session
     */
    public cancelExistingRequest(sessionId: string): void {
        const existingController = this.activeRequests.get(sessionId);
        if (existingController && !existingController.signal.aborted) {
            logger.info(`[LangGraph] Cancelling existing request for session: ${sessionId}`);
            existingController.abort();
            this.activeRequests.delete(sessionId);
        }
    }

    /**
     * Get workflow status for a session
     */
    public async getWorkflowStatus(sessionId: string): Promise<{ isActive: boolean }> {
        const isActive = this.activeRequests.has(sessionId);
        return { isActive };
    }

    /**
     * Clear memory for a session
     */
    public async clearMemory(sessionId: string): Promise<void> {
        this.memoryService.clearMemory(sessionId);
        logger.info(`[LangGraph] Cleared memory for session: ${sessionId}`);
    }

    /**
     * Test connection to Ollama
     */
    public async testConnection(): Promise<boolean> {
        try {
            const response = await this.chatModel.invoke("Test connection");
            logger.info('LangGraph Chat service connection test successful');
            return true;
        } catch (error) {
            logger.error('LangGraph Chat service connection test failed:', error);
            return false;
        }
    }

}

// Export singleton instance
export const langGraphChatService = new LangGraphChatService();