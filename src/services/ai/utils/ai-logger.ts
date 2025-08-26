import { logger } from '../../../utils/logger';

// Environment-based logging configuration for AI services
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

export class AILogger {
    // Critical errors - always log
    static error(message: string, error?: any): void {
        logger.error(`[AI] ${message}`, error);
    }

    // Warnings - always log but less verbose in production
    static warn(message: string, context?: any): void {
        if (isProduction) {
            logger.warn(`[AI] ${message}`);
        } else {
            logger.warn(`[AI] ${message}`, context);
        }
    }

    // Info logs - minimal in production, detailed in development
    static info(message: string, context?: any): void {
        if (isDevelopment) {
            logger.info(`[AI] ${message}`, context);
        }
        // Skip info logs in production for performance
    }

    // Debug logs - only in development
    static debug(message: string, context?: any): void {
        if (isDevelopment) {
            logger.debug(`[AI] ${message}`, context);
        }
    }

    // Performance logs - track timing without sensitive data
    static performance(operation: string, duration: number, sessionId?: string): void {
        if (isDevelopment) {
            logger.info(`[AI-Perf] ${operation}: ${duration}ms${sessionId ? ` (session: ${sessionId})` : ''}`);
        }
        // In production, only log if unusually slow
        else if (duration > 10000) { // 10+ seconds
            logger.warn(`[AI-Perf] Slow operation: ${operation} took ${duration}ms`);
        }
    }

    // Token usage - only in development, sanitized in production
    static tokenUsage(operation: string, estimatedTokens: number, sessionId?: string): void {
        if (isDevelopment) {
            logger.debug(`[AI-Tokens] ${operation}: ~${estimatedTokens} tokens${sessionId ? ` (session: ${sessionId})` : ''}`);
        }
        // In production, only log excessive token usage
        else if (estimatedTokens > 5000) {
            logger.warn(`[AI-Tokens] High token usage: ${operation} (~${estimatedTokens} tokens)`);
        }
    }

    // Workflow logs - essential state transitions only
    static workflow(message: string, sessionId?: string): void {
        if (isDevelopment) {
            logger.info(`[AI-Workflow] ${message}${sessionId ? ` (session: ${sessionId})` : ''}`);
        }
        // In production, only log workflow errors or completion
        // Regular workflow steps are skipped for performance
    }

    // Service startup and configuration
    static service(message: string): void {
        logger.info(`[AI-Service] ${message}`);
    }

    // Should file operations be enabled?
    static shouldWriteFiles(): boolean {
        return isDevelopment;
    }

    // Should detailed context be logged?
    static shouldLogContext(): boolean {
        return isDevelopment;
    }
}