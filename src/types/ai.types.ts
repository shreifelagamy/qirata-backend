import { Message } from "../entities";
import { SocialPlatform } from "../entities/social-post.entity";

export interface AICallbackData {
    event: 'start' | 'token' | 'end' | 'error';
    token?: string;
    error?: string;
    sessionId: string;
}

export interface AIStreamCallback {
    (data: AICallbackData): void;
}

export interface UserIntent {
    type: 'question' | 'social';
    confidence: number;
    keywords: string[];
}

export interface AIContext {
    postContent?: string;
    postSummary?: string;
    previousMessages?: Message[];
    socialPosts?: {
        platform: SocialPlatform;
        content: string;
        id: string;
        createdAt: Date;
        publishedAt?: Date;
    }[];
    socialMediaContentPreferences?: string;
    patternInsights?: string;
    conversationSummary?: string;
}

export interface AISessionMemory {
    sessionId: string;
    memory: any; // LangChain memory object
    lastActivity: Date;
    tokenCount: number;
}

export interface LangChainServiceConfig {
    ollamaUrl: string;
    model: string;
    maxTokens: number;
    temperature: number;
    memoryTokenLimit: number;
    sessionCleanupInterval: number; // in minutes
}

export interface PromptTemplates {
    questionPrompt: string;
    socialPostPrompt: string;
    systemPrompt: string;
    intentDetectionPrompt: string;
}

export interface IntentDetectionResult {
    intent: UserIntent;
    detectedKeywords: string[];
    rawMessage: string;
    aiReasoning?: string;
}

export interface AIResponse {
    content: string;
    intent: UserIntent;
    sessionId: string;
    tokenCount: number;
    processingTime: number;
}

export interface StreamingAIResponse {
    sessionId: string;
    isComplete: boolean;
    content: string;
    error?: string;
    summary?: string;
    isSocialPost?: boolean;
    socialPlatform?: SocialPlatform;
}