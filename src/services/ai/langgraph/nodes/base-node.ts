import { SocialPlatform } from '../../../../entities/social-post.entity';
import { AIContext, AIStreamCallback } from '../../../../types/ai.types';
import { WorkflowModels } from '../../../../types/model-config.types';
import { logger } from '../../../../utils/logger';
import { IntentDetectionResponse } from '../../agents/intent-detection.agent';
import { PlatformDetectionResponse } from '../../agents/platform-detection.agent';

export interface ChatState {
    // Input
    sessionId: string;
    userMessage: string;
    postContent?: string;
    postSummary?: string;
    previousMessages?: any[];
    conversationSummary?: string;
    socialMediaContentPreferences?: string;
    socialPosts?: {
        platform: SocialPlatform;
        content: string;
        id: string;
        createdAt: Date;
        publishedAt?: Date;
    }[];
    callback?: AIStreamCallback;

    // Model Configuration
    models?: WorkflowModels;

    // Processing State
    memory?: any;
    context?: AIContext;
    intent?: IntentDetectionResponse;
    platformDetection?: PlatformDetectionResponse;

    // Output
    aiResponse?: string;
    responseType?: 'question_answer' | 'social' | 'platform_clarification';
    socialPlatform?: string;
    isSocialPost?: boolean;
    error?: string;
    tokenCount?: number;
    processingTime?: number;
}

export abstract class BaseNode {
    protected nodeName: string;

    constructor(nodeName: string) {
        this.nodeName = nodeName;
    }

    protected logInfo(message: string, sessionId?: string): void {
        const logMessage = sessionId
            ? `[LangGraph:${this.nodeName}] ${message} for session: ${sessionId}`
            : `[LangGraph:${this.nodeName}] ${message}`;
        logger.info(logMessage);
    }

    protected logError(message: string, error: unknown, sessionId?: string): void {
        const logMessage = sessionId
            ? `[LangGraph:${this.nodeName}] ${message} for session: ${sessionId}`
            : `[LangGraph:${this.nodeName}] ${message}`;
        logger.error(logMessage, error);
    }

    protected handleError(operation: string, error: unknown): Partial<ChatState> {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            error: `${operation} failed: ${errorMessage}`
        };
    }

    protected estimateTokenCount(text: string): number {
        return Math.ceil(text.length / 4);
    }

    abstract execute(state: ChatState): Promise<Partial<ChatState>>;
}