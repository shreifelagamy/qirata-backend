import { Router } from 'express';
import { body } from 'express-validator';
import { SettingsController } from '../controllers/settings.controller';
import { validate, commonValidation } from '../middleware/validation.middleware';
import { strictLimiter } from '../middleware/rateLimit.middleware';

export function createSettingsRouter(): Router {
  const router = Router();
  const settingsController = new SettingsController();

  // Apply strict rate limiting to all settings routes
  router.use((req, res, next) => strictLimiter(req, res, next));

  router.get(
    '/:key',
    validate([
      body('key').isString().trim().notEmpty()
    ]),
    settingsController.show.bind(settingsController)
  );

  router.patch(
    '/:key',
    validate([
      body('key').isString().trim().notEmpty(),
      body('value').isString().notEmpty(),
      body('description').optional().isString()
    ]),
    settingsController.update.bind(settingsController)
  );

  return router;
}