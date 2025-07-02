import { ChatOllama } from '@langchain/ollama';

export interface ModelConfig {
    baseUrl: string;
    model: string;
    temperature: number;
}

export interface WorkflowModelConfigs {
    conversationSummary: ModelConfig;
    intentDetection: ModelConfig;
    platformDetection: ModelConfig;
    questionHandler: ModelConfig;
    socialPostGenerator: ModelConfig;
    memoryService: ModelConfig;
}

export interface WorkflowModels {
    conversationSummary: ChatOllama;
    intentDetection: ChatOllama;
    platformDetection: ChatOllama;
    questionHandler: ChatOllama;
    socialPostGenerator: ChatOllama;
    memoryService: ChatOllama;
}

export const DEFAULT_MODEL_CONFIGS: WorkflowModelConfigs = {
    conversationSummary: {
        baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.SUMMARY_MODEL || process.env.OLLAMA_MODEL || 'mistral:7b',
        temperature: parseFloat(process.env.SUMMARY_TEMPERATURE || '0.5'),
    },
    intentDetection: {
        baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.INTENT_MODEL || process.env.OLLAMA_MODEL || 'mistral:7b',
        temperature: parseFloat(process.env.INTENT_TEMPERATURE || '0.3'),
    },
    platformDetection: {
        baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.PLATFORM_MODEL || process.env.OLLAMA_MODEL || 'mistral:7b',
        temperature: parseFloat(process.env.PLATFORM_TEMPERATURE || '0.1'),
    },
    questionHandler: {
        baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.QUESTION_MODEL || process.env.OLLAMA_MODEL || 'mistral:7b',
        temperature: parseFloat(process.env.QUESTION_TEMPERATURE || '0.7'),
    },
    socialPostGenerator: {
        baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.SOCIAL_POST_MODEL || process.env.OLLAMA_MODEL || 'mistral:7b',
        temperature: parseFloat(process.env.SOCIAL_POST_TEMPERATURE || '0.8'),
    },
    memoryService: {
        baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.MEMORY_MODEL || process.env.OLLAMA_MODEL || 'mistral:7b',
        temperature: parseFloat(process.env.MEMORY_TEMPERATURE || '0.5'),
    }
};

export function createModelFromConfig(config: ModelConfig): ChatOllama {
    return new ChatOllama({
        baseUrl: config.baseUrl,
        model: config.model,
        temperature: config.temperature,
    });
}

export function createWorkflowModels(configs: WorkflowModelConfigs): WorkflowModels {
    return {
        conversationSummary: createModelFromConfig(configs.conversationSummary),
        intentDetection: createModelFromConfig(configs.intentDetection),
        platformDetection: createModelFromConfig(configs.platformDetection),
        questionHandler: createModelFromConfig(configs.questionHandler),
        socialPostGenerator: createModelFromConfig(configs.socialPostGenerator),
        memoryService: createModelFromConfig(configs.memoryService),
    };
}