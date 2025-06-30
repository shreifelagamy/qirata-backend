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
    type: 'question' | 'social_post';
    confidence: number;
    keywords: string[];
}

export interface AIContext {
    postContent?: string;
    previousMessages?: Message[];
    userPreferences?: {
        tone?: string;
        platform?: 'twitter' | 'linkedin' | 'general';
        length?: 'short' | 'medium' | 'long';
        voice?: 'professional' | 'friendly' | 'direct' | 'storyteller';
        contentStyle?: 'data-driven' | 'practical' | 'thought-provoking';
        hookPreference?: 'questions' | 'observations' | 'bold-claims';
    };
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