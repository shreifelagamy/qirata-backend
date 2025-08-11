import { Message } from "../entities";
import { SocialPlatform } from "../entities/social-post.entity";
import { StructuredSocialPostOutput } from "../services/ai/agents/social-post-generator.agent";

export interface AICallbackData {
    event: 'start' | 'token' | 'end' | 'error' | 'interrupted' | 'social:start' | 'social:content' | 'social:complete';
    token?: string;
    error?: string;
    sessionId: string;
    // Additional fields for enhanced social post streaming
    stage?: 'starting' | 'content' | 'code' | 'visual' | 'completing';
    message?: string;
    content?: string;
    type?: 'code' | 'visual';
    index?: number;
    data?: any;
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
    totalMessageCount?: number;
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
    structuredSocialPost?: StructuredSocialPostOutput;
}