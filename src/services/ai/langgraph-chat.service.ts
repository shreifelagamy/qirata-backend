import fs from 'fs';
import {
    AIContext,
    AIResponse,
    AIStreamCallback,
    StreamingAIResponse
} from '../../types/ai.types';
import { DEFAULT_MODEL_CONFIGS, WorkflowModelConfigs } from '../../types/model-config.types';
import { logger } from '../../utils/logger';
import { WorkflowBuilder } from './langgraph/builders/workflow-builder';
import { ChatState } from './langgraph/nodes/base-node';



export class LangGraphChatService {
    private app: any;
    private activeRequests = new Map<string, AbortController>();
    private modelConfigs: WorkflowModelConfigs;
    private workflowBuilder: WorkflowBuilder;

    constructor(modelConfigs?: WorkflowModelConfigs) {
        // Use provided configs or defaults
        this.modelConfigs = modelConfigs || DEFAULT_MODEL_CONFIGS;

        // Initialize workflow builder with model configurations
        this.workflowBuilder = new WorkflowBuilder(this.modelConfigs);

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

            // Generate visual representation for LangGraph Studio
            await this.generateGraphVisualization();

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
                postSummary: context.postSummary,
                previousMessages: context.previousMessages,
                conversationSummary: context.conversationSummary,
                userPreferences: context.userPreferences,
                socialPosts: context.socialPosts,
                callback: streamCallback,
            };

            logger.info(`[LangGraph] Starting workflow for session: ${sessionId}`);
            logger.info(`[LangGraph] social posts: ${initialState.socialPosts}`);

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
                summary: result.conversationSummary || '', // Summary will be handled within the workflow
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
            intent: { type: streamingResponse.isSocialPost ? 'social' : 'question', confidence: 0.9, keywords: [] },
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
        const { createModelFromConfig } = await import('../../types/model-config.types');
        const { MemoryService } = await import('./memory.service');

        const memoryModel = createModelFromConfig(this.modelConfigs.memoryService);
        const memoryService = new MemoryService(memoryModel);
        memoryService.clearMemory(sessionId);

        logger.info(`[LangGraph] Cleared memory for session: ${sessionId}`);
    }

    /**
     * Test connection to Ollama with a specific model
     */
    public async testConnection(modelType: keyof WorkflowModelConfigs = 'questionHandler'): Promise<boolean> {
        try {
            const { createModelFromConfig } = await import('../../types/model-config.types');
            const testModel = createModelFromConfig(this.modelConfigs[modelType]);
            const response = await testModel.invoke("Test connection");
            logger.info(`LangGraph Chat service connection test successful for ${modelType} model`);
            return true;
        } catch (error) {
            logger.error(`LangGraph Chat service connection test failed for ${modelType} model:`, error);
            return false;
        }
    }

    /**
     * Get current model configurations
     */
    public getModelConfigs(): WorkflowModelConfigs {
        return { ...this.modelConfigs };
    }

    /**
     * Update model configurations and rebuild workflow
     */
    public updateModelConfigs(newConfigs: Partial<WorkflowModelConfigs>): void {
        this.modelConfigs = { ...this.modelConfigs, ...newConfigs };

        // Rebuild workflow with new configurations
        this.workflowBuilder = new WorkflowBuilder(this.modelConfigs);
        this.app = this.workflowBuilder.buildWorkflow();

        logger.info('Model configurations updated and workflow rebuilt');
    }

    /**
     * Generate graph visualization for LangGraph Studio
     */
    private async generateGraphVisualization(): Promise<void> {
        try {
            const graphBlob = await this.app.getGraph().drawMermaidPng();
            const graphBuffer = Buffer.from(await graphBlob.arrayBuffer());
            fs.writeFileSync('graph.png', graphBuffer);

            // Also generate mermaid text for Studio
            const mermaidText = this.app.getGraph().drawMermaid();
            fs.writeFileSync('graph.mermaid', mermaidText);

            logger.info('Graph visualization generated for LangGraph Studio');
        } catch (error) {
            logger.warn('Failed to generate graph visualization:', error);
        }
    }
}

// Export singleton instance
export const langGraphChatService = new LangGraphChatService();