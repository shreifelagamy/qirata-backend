import { WorkflowModelConfigs } from '../types/model-config.types';

/**
 * Example model configurations for different use cases
 */

// Default configuration - single model for all services
export const SINGLE_MODEL_CONFIG: WorkflowModelConfigs = {
    intentDetection: {
        baseUrl: 'http://localhost:11434',
        model: 'mistral:7b',
        temperature: 0.3,
    },
    platformDetection: {
        baseUrl: 'http://localhost:11434',
        model: 'mistral:7b',
        temperature: 0.1,
    },
    questionHandler: {
        baseUrl: 'http://localhost:11434',
        model: 'mistral:7b',
        temperature: 0.7,
    },
    socialPostGenerator: {
        baseUrl: 'http://localhost:11434',
        model: 'mistral:7b',
        temperature: 0.8,
    },
    memoryService: {
        baseUrl: 'http://localhost:11434',
        model: 'mistral:7b',
        temperature: 0.5,
    }
};

// Multi-model configuration - specialized models for different tasks
export const SPECIALIZED_MODEL_CONFIG: WorkflowModelConfigs = {
    intentDetection: {
        baseUrl: 'http://localhost:11434',
        model: 'llama3:8b',           // Fast model for classification
        temperature: 0.1,             // Low temperature for consistent classification
    },
    platformDetection: {
        baseUrl: 'http://localhost:11434',
        model: 'llama3:8b',           // Fast model for classification
        temperature: 0.0,             // Very low temperature for deterministic detection
    },
    questionHandler: {
        baseUrl: 'http://localhost:11434',
        model: 'mistral:7b',          // Balanced model for Q&A
        temperature: 0.7,             // Higher temperature for creative responses
    },
    socialPostGenerator: {
        baseUrl: 'http://localhost:11434',
        model: 'mistral:7b',          // Creative model for content generation
        temperature: 0.9,             // High temperature for creative content
    },
    memoryService: {
        baseUrl: 'http://localhost:11434',
        model: 'llama3:8b',           // Fast model for summarization
        temperature: 0.3,             // Low temperature for consistent summaries
    }
};

// Production configuration - optimized for performance and quality
export const PRODUCTION_MODEL_CONFIG: WorkflowModelConfigs = {
    intentDetection: {
        baseUrl: 'http://localhost:11434',
        model: 'mistral:7b-instruct',
        temperature: 0.2,
    },
    platformDetection: {
        baseUrl: 'http://localhost:11434',
        model: 'mistral:7b-instruct',
        temperature: 0.1,
    },
    questionHandler: {
        baseUrl: 'http://localhost:11434',
        model: 'mistral:7b-instruct',
        temperature: 0.6,
    },
    socialPostGenerator: {
        baseUrl: 'http://localhost:11434',
        model: 'mistral:7b-instruct',
        temperature: 0.8,
    },
    memoryService: {
        baseUrl: 'http://localhost:11434',
        model: 'mistral:7b-instruct',
        temperature: 0.4,
    }
};

// Development configuration - faster models for development
export const DEVELOPMENT_MODEL_CONFIG: WorkflowModelConfigs = {
    intentDetection: {
        baseUrl: 'http://localhost:11434',
        model: 'llama3:8b',
        temperature: 0.3,
    },
    platformDetection: {
        baseUrl: 'http://localhost:11434',
        model: 'llama3:8b',
        temperature: 0.1,
    },
    questionHandler: {
        baseUrl: 'http://localhost:11434',
        model: 'llama3:8b',
        temperature: 0.7,
    },
    socialPostGenerator: {
        baseUrl: 'http://localhost:11434',
        model: 'llama3:8b',
        temperature: 0.8,
    },
    memoryService: {
        baseUrl: 'http://localhost:11434',
        model: 'llama3:8b',
        temperature: 0.5,
    }
};