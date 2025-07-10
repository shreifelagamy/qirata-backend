import { Router } from 'express';
import { body, param } from 'express-validator';
import { SettingsController } from '../controllers/settings.controller';
import { strictLimiter } from '../middleware/rateLimit.middleware';
import { validate } from '../middleware/validation.middleware';

export function createSettingsRouter(): Router {
    const router = Router();
    const settingsController = new SettingsController();

    // Apply strict rate limiting to all settings routes
    router.use((req, res, next) => strictLimiter(req, res, next));

    // Get all settings
    router.get(
        '/',
        settingsController.index.bind(settingsController)
    );

    // Get setting by key
    router.get(
        '/:key',
        validate([
            param('key').isString().trim().notEmpty()
        ]),
        settingsController.show.bind(settingsController)
    );

    // Upsert setting by key
    router.patch(
        '/:key',
        validate([
            param('key').isString().trim().notEmpty(),
            body('value').isString().optional(),
            body('description').optional().isString()
        ]),
        settingsController.upsert.bind(settingsController)
    );

    return router;
}