import { logger } from '../../../../utils/logger';
import { AIContext, AIStreamCallback, UserIntent } from '../../../../types/ai.types';
import { SocialPlatform } from '../../../../entities/social-post.entity';
import { PlatformDetectionResult } from '../../platform-detection.service';

export interface ChatState {
    // Input
    sessionId: string;
    userMessage: string;
    postContent?: string;
    previousMessages?: any[];
    conversationSummary?: string;
    userPreferences?: any;
    callback?: AIStreamCallback;

    // Processing State
    memory?: any;
    context?: AIContext;
    intent?: UserIntent;
    confidence?: number;
    platformDetection?: PlatformDetectionResult;
    needsPlatformClarification?: boolean;
    waitingForPlatformChoice?: boolean;

    // Output
    aiResponse?: string;
    responseType?: 'question_answer' | 'social_post' | 'platform_clarification';
    socialPlatform?: SocialPlatform;
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