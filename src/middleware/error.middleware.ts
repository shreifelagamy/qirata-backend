// middleware/error.middleware.ts
import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

export class HttpError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'HttpError';
    }
}

interface ErrorResponse {
    message: string;
    status: number;
    errors?: Record<string, string[]>;
    data?: { [key: string]: any };
}

export const errorMiddleware = (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Prevent sending response if already sent
    if (res.headersSent) {
        return next(error);
    }

    const status = error instanceof HttpError ? error.status : 500;

    const response: ErrorResponse = {
        message: error instanceof HttpError ? error.message : 'Internal Server Error',
        status: status
    };

    // Include additional data in development
    if (process.env.NODE_ENV === 'development') {
        response.data = {
            timestamp: new Date().toISOString(),
            path: req.path,
            method: req.method,
            stack: error.stack
        };
    }

    // Log error
    if (!(error instanceof HttpError) || error.status >= 500) {
        logger.error('Error occurred:', {
            error: error.message,
            stack: error.stack,
            path: req.path,
            method: req.method,
            status
        });
    }

    // Always return JSON
    res.status(status).json(response);
};