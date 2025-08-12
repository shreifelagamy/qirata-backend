import { NextFunction, Request, Response } from 'express';
import { param, query, ValidationChain, validationResult } from 'express-validator';
import { logger } from '../utils/logger';

export const validate = (validations: ValidationChain[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Execute all validations
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

        logger.warn('Validation failed:', {
            path: req.path,
            method: req.method,
            errors: errors.array()
        });

        res.status(400).json({
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.type === 'field' ? err.path : err.type,
                message: err.msg,
                value: err.type === 'field' ? err.value : undefined
            }))
        });
    };
};

// Common validation chains
export const commonValidation = {
    id: (field: string = 'id') => [
        param(field)
            .isUUID()
            .withMessage('ID must be a valid UUID')
    ],

    pagination: [
      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer')
        .toInt(),
      query('pageSize')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Page size must be between 1 and 100')
        .toInt(),
      query('sortBy')
        .optional()
        .isIn(['createdAt', 'publishedAt', 'title'])
        .withMessage('Invalid sort field'),
      query('sortOrder')
        .optional()
        .isIn(['ASC', 'DESC'])
        .withMessage('Sort order must be ASC or DESC')
    ],

    cursorPagination: [
      query('cursor')
        .optional()
        .isISO8601()
        .withMessage('Cursor must be a valid ISO timestamp')
        .toDate(),
      query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Limit must be between 1 and 50')
        .toInt()
    ],

    search: [
        query('search')
            .optional()
            .isString()
            .trim()
            .isLength({ min: 1 })
            .withMessage('Search query must not be empty')
    ]
};