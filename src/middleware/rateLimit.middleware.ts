import dotenv from 'dotenv';
import { NextFunction, Request, Response } from 'express';
import rateLimit, { Options } from 'express-rate-limit';
import { logger } from '../utils/logger';

dotenv.config();

const isDevelopment = process.env.NODE_ENV === 'development';

// Create custom rate limiter with logging
export const createRateLimiter = (options: Partial<Options>) => {
    if (isDevelopment) {
        return (req: Request, res: Response, next: NextFunction) => {
            next(); // Skip rate limiting in development
        };
    }

    return rateLimit({
        windowMs: options.windowMs || 15 * 60 * 1000, // Default: 15 minutes
        max: options.max || 100, // Default: 100 requests per windowMs
        message: options.message || 'Too many requests, please try again later',
        handler: (req, res): void => {
            logger.warn('Rate limit exceeded:', {
                ip: req.ip,
                path: req.path,
                method: req.method
            });
            res.status(429).json({
                message: options.message || 'Too many requests, please try again later'
            });
        }
    });
};

// Default API rate limiter
export const apiLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // 100 requests per windowMs
});

// Strict rate limiter for sensitive endpoints
export const strictLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30, // 30 requests per hour
    message: 'Too many requests for this sensitive operation, please try again later'
});

// Per-IP rate limiter for public endpoints
export const publicLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50 // 50 requests per 5 minutes
});